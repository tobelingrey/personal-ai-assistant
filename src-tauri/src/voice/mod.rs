//! Voice module - wake word detection, audio capture, and state management

pub mod audio_capture;
pub mod buffer;
pub mod config;
pub mod state_machine;
pub mod vad;
pub mod wake_word;

use parking_lot::RwLock;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};
use thiserror::Error;
use tokio::sync::mpsc;

pub use config::VoiceConfig;
pub use state_machine::{VoiceEvent, VoiceState, VoiceStateMachine};
pub use audio_capture::{list_input_devices, list_output_devices, AudioDeviceInfo};

use audio_capture::{AudioCapture, AudioCaptureError};
use vad::{VadResult, VoiceActivityDetector};
use wake_word::{WakeWordDetector, WakeWordError};

#[derive(Error, Debug)]
pub enum VoiceError {
    #[error("Audio capture error: {0}")]
    AudioCapture(#[from] AudioCaptureError),
    #[error("Wake word error: {0}")]
    WakeWord(#[from] WakeWordError),
    #[error("Voice system not initialized")]
    NotInitialized,
    #[error("Models not found at: {0}")]
    ModelsNotFound(String),
}

/// Events emitted to the frontend
#[derive(Clone, serde::Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum VoiceFrontendEvent {
    /// Voice state changed
    StateChanged(VoiceState),
    /// Wake word detected with confidence score
    WakeWordDetected { score: f32 },
    /// Error occurred
    Error { message: String },
    /// Audio level update (for visualization)
    AudioLevel { rms: f32 },
}

/// Shared state for the voice controller
struct VoiceControllerInternalState {
    state_machine: VoiceStateMachine,
    config: VoiceConfig,
    is_running: bool,
    wake_word_enabled: bool,
    input_device: Option<String>,
    output_device: Option<String>,
}

/// Main voice controller that orchestrates all voice components
pub struct VoiceController {
    state: Arc<RwLock<VoiceControllerInternalState>>,
    audio_tx: Option<mpsc::UnboundedSender<Vec<f32>>>,
    models_dir: PathBuf,
    app_handle: Option<AppHandle>,
}

impl VoiceController {
    /// Create a new voice controller
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            state: Arc::new(RwLock::new(VoiceControllerInternalState {
                state_machine: VoiceStateMachine::new(),
                config: VoiceConfig::default(),
                is_running: false,
                wake_word_enabled: true,
                input_device: None,
                output_device: None,
            })),
            audio_tx: None,
            models_dir,
            app_handle: None,
        }
    }

    /// Set the input device to use
    pub fn set_input_device(&self, device_name: Option<String>) {
        self.state.write().input_device = device_name;
    }

    /// Set the output device to use
    pub fn set_output_device(&self, device_name: Option<String>) {
        self.state.write().output_device = device_name;
    }

    /// Get current input device
    pub fn get_input_device(&self) -> Option<String> {
        self.state.read().input_device.clone()
    }

    /// Get current output device
    pub fn get_output_device(&self) -> Option<String> {
        self.state.read().output_device.clone()
    }

    /// Set the Tauri app handle for event emission
    pub fn set_app_handle(&mut self, app_handle: AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Start the voice system
    pub fn start(&mut self) -> Result<(), VoiceError> {
        emit_debug_log(&self.app_handle, "info", &format!("Starting voice system, models dir: {:?}", self.models_dir));

        // Check if models exist
        if !self.models_dir.exists() {
            emit_debug_log(&self.app_handle, "error", &format!("Models directory not found: {:?}", self.models_dir));
            return Err(VoiceError::ModelsNotFound(
                self.models_dir.display().to_string(),
            ));
        }

        // Check individual model files
        let melspec_path = self.models_dir.join("melspectrogram.onnx");
        let embedding_path = self.models_dir.join("embedding_model.onnx");
        let wakeword_path = self.models_dir.join("hey_jarvis.onnx");

        emit_debug_log(&self.app_handle, "info", &format!("Checking models: melspec={}, embedding={}, wakeword={}",
            melspec_path.exists(), embedding_path.exists(), wakeword_path.exists()));

        let config = self.state.read().config.clone();
        let models_dir = self.models_dir.clone();
        let state = self.state.clone();
        let app_handle = self.app_handle.clone();

        // Create audio channel
        let (audio_tx, mut audio_rx) = mpsc::unbounded_channel::<Vec<f32>>();
        self.audio_tx = Some(audio_tx.clone());

        // Mark as running
        self.state.write().is_running = true;

        emit_debug_log(&self.app_handle, "info", "Spawning audio processing thread...");

        // Spawn audio processing thread
        thread::spawn(move || {
            emit_debug_log(&app_handle, "info", "Audio processing thread started");

            // Initialize components
            emit_debug_log(&app_handle, "info", "Loading wake word detector models...");
            let wake_word_detector = match WakeWordDetector::new(&models_dir, config.clone()) {
                Ok(detector) => {
                    emit_debug_log(&app_handle, "info", "Wake word detector initialized successfully");
                    Some(detector)
                }
                Err(e) => {
                    emit_debug_log(&app_handle, "error", &format!("Failed to init wake word detector: {}", e));
                    log::error!("Failed to initialize wake word detector: {}", e);
                    if let Some(ref handle) = app_handle {
                        let _ = handle.emit("voice-error", format!("Wake word init failed: {}", e));
                    }
                    None
                }
            };

            let mut wake_word_detector = wake_word_detector;
            let mut vad = VoiceActivityDetector::new(&config);
            let mut audio_buffer = buffer::AudioBuffer::new(config.chunk_size * 2);
            let mut chunk_count: u64 = 0;

            // Create a tokio runtime for this thread
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("Failed to create tokio runtime");

            emit_debug_log(&app_handle, "info", "Entering audio processing loop, waiting for audio...");

            rt.block_on(async {
                while let Some(samples) = audio_rx.recv().await {
                    chunk_count += 1;

                    // Log every 100th chunk to avoid spam
                    if chunk_count == 1 {
                        emit_debug_log(&app_handle, "info", &format!("First audio chunk received: {} samples", samples.len()));
                    } else if chunk_count % 100 == 0 {
                        emit_debug_log(&app_handle, "debug", &format!("Processed {} audio chunks", chunk_count));
                    }

                    let state_guard = state.read();
                    if !state_guard.is_running {
                        emit_debug_log(&app_handle, "info", "Voice system stopping...");
                        break;
                    }
                    let current_state = state_guard.state_machine.state();
                    let wake_word_enabled = state_guard.wake_word_enabled;
                    drop(state_guard);

                    // Add samples to buffer
                    audio_buffer.push_samples(&samples);

                    // Emit audio level for visualization
                    let rms = calculate_rms(&samples);
                    if let Some(ref handle) = app_handle {
                        let _ = handle.emit("voice-audio-level", rms);
                    }

                    match current_state {
                        VoiceState::Idle => {
                            // Check for wake word
                            if wake_word_enabled {
                                if let Some(ref mut detector) = wake_word_detector {
                                    match detector.process_audio(&samples) {
                                        Ok(Some(score)) => {
                                            // Log scores periodically or when above threshold
                                            if score > 0.2 || chunk_count % 50 == 0 {
                                                emit_debug_log(&app_handle, "debug", &format!("Wake word score: {:.3}", score));
                                            }
                                            if detector.is_detected(score) {
                                                emit_debug_log(&app_handle, "info", &format!("WAKE WORD DETECTED! Score: {:.3}", score));
                                                log::info!("Wake word detected! Score: {}", score);

                                            // Transition to Listening
                                            let mut state_guard = state.write();
                                            state_guard
                                                .state_machine
                                                .transition(VoiceEvent::WakeWordDetected);
                                            let new_state = state_guard.state_machine.state();
                                            drop(state_guard);

                                            // Emit events
                                            if let Some(ref handle) = app_handle {
                                                let _ = handle.emit(
                                                    "voice-wake-word",
                                                    serde_json::json!({ "score": score }),
                                                );
                                                let _ = handle.emit("voice-state-changed", new_state);
                                            }

                                            // Reset VAD for new utterance
                                            vad.reset();
                                        }
                                    }
                                        Ok(None) => {
                                            // Not enough data yet, continue accumulating
                                        }
                                        Err(e) => {
                                            emit_debug_log(&app_handle, "error", &format!("Wake word error: {}", e));
                                        }
                                    }
                                }
                            }
                        }
                        VoiceState::Listening => {
                            // Add audio to state machine buffer
                            state.write().state_machine.add_audio(&samples);

                            // Check VAD for speech end
                            let vad_result = vad.process(&samples);
                            if vad_result == VadResult::SpeechEnd {
                                log::info!("Speech end detected");

                                let mut state_guard = state.write();
                                let result =
                                    state_guard.state_machine.transition(VoiceEvent::VadSpeechEnd);
                                let new_state = result.new_state;
                                drop(state_guard);

                                if let Some(ref handle) = app_handle {
                                    let _ = handle.emit("voice-state-changed", new_state);

                                    // Emit the captured audio for transcription
                                    if let Some(state_machine::StateAction::SendToStt(audio)) =
                                        result.action
                                    {
                                        let _ = handle.emit("voice-audio-captured", audio);
                                    }
                                }

                                vad.reset();

                                // Reset wake word detector buffer
                                if let Some(ref mut detector) = wake_word_detector {
                                    detector.reset();
                                }
                            }
                        }
                        _ => {
                            // Other states don't process audio for wake word / VAD
                        }
                    }
                }
            });

            log::info!("Voice processing thread exiting");
        });

        // Start audio capture with selected device
        let state_guard = self.state.read();
        let input_device = state_guard.input_device.clone();
        let voice_config = state_guard.config.clone();
        drop(state_guard);

        let mut audio_capture = AudioCapture::with_device(
            &voice_config,
            input_device.as_deref(),
        )?;
        audio_capture.start(audio_tx)?;

        log::info!("Voice controller started");
        Ok(())
    }

    /// Stop the voice system
    pub fn stop(&mut self) {
        self.state.write().is_running = false;
        self.audio_tx = None;
        log::info!("Voice controller stopped");
    }

    /// Manually trigger listening (push-to-talk)
    pub fn manual_trigger(&self) {
        let mut state = self.state.write();
        let result = state.state_machine.transition(VoiceEvent::ManualTrigger);

        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("voice-state-changed", result.new_state);
        }
    }

    /// Cancel current operation
    pub fn cancel(&self) {
        let mut state = self.state.write();
        let result = state.state_machine.transition(VoiceEvent::Cancel);

        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("voice-state-changed", result.new_state);
        }
    }

    /// Set wake word sensitivity
    pub fn set_sensitivity(&self, sensitivity: f32) {
        let mut state = self.state.write();
        state.config.sensitivity = sensitivity.clamp(0.1, 3.0);
    }

    /// Enable or disable wake word detection
    pub fn set_wake_word_enabled(&self, enabled: bool) {
        self.state.write().wake_word_enabled = enabled;
    }

    /// Get current state
    pub fn current_state(&self) -> VoiceState {
        self.state.read().state_machine.state()
    }

    /// Check if voice system is running
    pub fn is_running(&self) -> bool {
        self.state.read().is_running
    }

    /// Notify that transcription is complete
    pub fn transcription_complete(&self, text: String) {
        let mut state = self.state.write();
        let result = state
            .state_machine
            .transition(VoiceEvent::TranscriptionComplete(text));

        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("voice-state-changed", result.new_state);
        }
    }

    /// Notify that AI response is ready
    pub fn response_ready(&self, response: String) {
        let mut state = self.state.write();
        let result = state
            .state_machine
            .transition(VoiceEvent::ResponseReady(response));

        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("voice-state-changed", result.new_state);
        }
    }

    /// Notify that TTS speech is complete
    pub fn speech_complete(&self) {
        let mut state = self.state.write();
        let result = state.state_machine.transition(VoiceEvent::SpeechComplete);

        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("voice-state-changed", result.new_state);
        }
    }
}

/// Calculate RMS of audio samples
fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();
    (sum_squares / samples.len() as f32).sqrt()
}

/// Emit a debug log message to the frontend
fn emit_debug_log(app_handle: &Option<AppHandle>, level: &str, message: &str) {
    log::info!("[{}] {}", level, message);
    if let Some(ref handle) = app_handle {
        let _ = handle.emit("debug-log", serde_json::json!({
            "level": level,
            "message": message
        }));
    }
}

/// Get the models directory from app handle
pub fn get_models_dir(app: &AppHandle) -> PathBuf {
    // First try the resource directory (for production builds)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let models_path = resource_dir.join("models");
        if models_path.exists() && models_path.join("melspectrogram.onnx").exists() {
            return models_path;
        }
    }

    // In dev mode, try relative to the executable's parent directories
    if let Ok(exe_path) = std::env::current_exe() {
        // Go up from target/debug to src-tauri/resources/models
        if let Some(target_dir) = exe_path.parent() {
            // target/debug -> target
            if let Some(target_parent) = target_dir.parent() {
                // target -> src-tauri
                if let Some(src_tauri) = target_parent.parent() {
                    let dev_models = src_tauri.join("resources").join("models");
                    if dev_models.exists() && dev_models.join("melspectrogram.onnx").exists() {
                        return dev_models;
                    }
                }
            }
        }
    }

    // Last resort: try current working directory
    let cwd_models = PathBuf::from("src-tauri/resources/models");
    if cwd_models.exists() {
        return cwd_models;
    }

    // Fallback
    PathBuf::from("resources/models")
}
