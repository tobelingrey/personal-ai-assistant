//! Voice controller - orchestrates wake word, VAD, and audio processing

use parking_lot::RwLock;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use super::audio_capture::AudioCapture;
use super::audio_processing::{emit_debug_log, run_audio_processing_loop, VoiceControllerState};
use super::state_machine::{VoiceEvent, VoiceState};
use super::VoiceError;

/// Main voice controller that orchestrates all voice components
pub struct VoiceController {
    state: Arc<RwLock<VoiceControllerState>>,
    audio_tx: Option<mpsc::UnboundedSender<Vec<f32>>>,
    models_dir: PathBuf,
    app_handle: Option<AppHandle>,
}

impl VoiceController {
    /// Create a new voice controller
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            state: Arc::new(RwLock::new(VoiceControllerState::new())),
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
        emit_debug_log(&self.app_handle, "info", &format!("Starting voice, models: {:?}", self.models_dir));

        if !self.models_dir.exists() {
            emit_debug_log(&self.app_handle, "error", "Models directory not found");
            return Err(VoiceError::ModelsNotFound(self.models_dir.display().to_string()));
        }

        let melspec = self.models_dir.join("melspectrogram.onnx");
        let embedding = self.models_dir.join("embedding_model.onnx");
        let wakeword = self.models_dir.join("hey_jarvis.onnx");

        emit_debug_log(&self.app_handle, "info", &format!(
            "Models: mel={}, emb={}, wake={}",
            melspec.exists(), embedding.exists(), wakeword.exists()
        ));

        let config = self.state.read().config.clone();
        let models_dir = self.models_dir.clone();
        let state = self.state.clone();
        let app_handle = self.app_handle.clone();

        let (audio_tx, mut audio_rx) = mpsc::unbounded_channel::<Vec<f32>>();
        self.audio_tx = Some(audio_tx.clone());
        self.state.write().is_running = true;

        emit_debug_log(&self.app_handle, "info", "Spawning audio processing thread...");

        thread::spawn(move || {
            run_audio_processing_loop(&app_handle, &models_dir, &config, &state, &mut audio_rx);
        });

        let state_guard = self.state.read();
        let input_device = state_guard.input_device.clone();
        let voice_config = state_guard.config.clone();
        drop(state_guard);

        let mut audio_capture = AudioCapture::with_device(&voice_config, input_device.as_deref())?;
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
        self.state.write().config.sensitivity = sensitivity.clamp(0.1, 3.0);
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
        let result = state.state_machine.transition(VoiceEvent::TranscriptionComplete(text));

        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("voice-state-changed", result.new_state);
        }
    }

    /// Notify that AI response is ready
    pub fn response_ready(&self, response: String) {
        let mut state = self.state.write();
        let result = state.state_machine.transition(VoiceEvent::ResponseReady(response));

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
