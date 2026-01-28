//! Audio processing helpers for the voice controller

use parking_lot::RwLock;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use super::buffer::AudioBuffer;
use super::config::VoiceConfig;
use super::state_machine::{StateAction, VoiceEvent, VoiceState, VoiceStateMachine};
use super::vad::{VadResult, VoiceActivityDetector};
use super::wake_word::WakeWordDetector;

/// Shared state for the voice controller
pub struct VoiceControllerState {
    pub state_machine: VoiceStateMachine,
    pub config: VoiceConfig,
    pub is_running: bool,
    pub wake_word_enabled: bool,
    pub input_device: Option<String>,
    pub output_device: Option<String>,
}

impl VoiceControllerState {
    pub fn new() -> Self {
        Self {
            state_machine: VoiceStateMachine::new(),
            config: VoiceConfig::default(),
            is_running: false,
            wake_word_enabled: true,
            input_device: None,
            output_device: None,
        }
    }
}

/// Run the audio processing loop in a dedicated thread
pub fn run_audio_processing_loop(
    app_handle: &Option<AppHandle>,
    models_dir: &std::path::PathBuf,
    config: &VoiceConfig,
    state: &Arc<RwLock<VoiceControllerState>>,
    audio_rx: &mut mpsc::UnboundedReceiver<Vec<f32>>,
) {
    emit_debug_log(app_handle, "info", "Audio processing thread started");

    // Initialize components
    emit_debug_log(app_handle, "info", "Loading wake word detector models...");
    let mut wake_word_detector = match WakeWordDetector::new(models_dir, config.clone()) {
        Ok(detector) => {
            emit_debug_log(app_handle, "info", "Wake word detector initialized");
            Some(detector)
        }
        Err(e) => {
            emit_debug_log(app_handle, "error", &format!("Wake word init failed: {}", e));
            log::error!("Failed to initialize wake word detector: {}", e);
            if let Some(ref handle) = app_handle {
                let _ = handle.emit("voice-error", format!("Wake word init failed: {}", e));
            }
            None
        }
    };

    let mut vad = VoiceActivityDetector::new(config);
    let mut audio_buffer = AudioBuffer::new(config.chunk_size * 2);
    let mut chunk_count: u64 = 0;

    // Create a tokio runtime for this thread
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("Failed to create tokio runtime");

    emit_debug_log(app_handle, "info", "Entering audio processing loop...");

    rt.block_on(async {
        while let Some(samples) = audio_rx.recv().await {
            chunk_count += 1;

            if chunk_count == 1 {
                emit_debug_log(app_handle, "info", &format!("First audio: {} samples", samples.len()));
            } else if chunk_count % 100 == 0 {
                emit_debug_log(app_handle, "debug", &format!("Processed {} chunks", chunk_count));
            }

            let state_guard = state.read();
            if !state_guard.is_running {
                emit_debug_log(app_handle, "info", "Voice system stopping...");
                break;
            }
            let current_state = state_guard.state_machine.state();
            let wake_word_enabled = state_guard.wake_word_enabled;
            drop(state_guard);

            audio_buffer.push_samples(&samples);

            // Emit audio level for visualization
            let rms = calculate_rms(&samples);
            if let Some(ref handle) = app_handle {
                let _ = handle.emit("voice-audio-level", rms);
            }

            process_audio_state(
                app_handle, state, current_state, wake_word_enabled,
                &samples, &mut wake_word_detector, &mut vad,
            );
        }
    });

    log::info!("Voice processing thread exiting");
}

/// Process audio based on current state
fn process_audio_state(
    app_handle: &Option<AppHandle>,
    state: &Arc<RwLock<VoiceControllerState>>,
    current_state: VoiceState,
    wake_word_enabled: bool,
    samples: &[f32],
    wake_word_detector: &mut Option<WakeWordDetector>,
    vad: &mut VoiceActivityDetector,
) {
    match current_state {
        VoiceState::Idle => {
            process_idle_state(app_handle, state, wake_word_enabled, samples, wake_word_detector, vad);
        }
        VoiceState::Listening => {
            process_listening_state(app_handle, state, samples, wake_word_detector, vad);
        }
        _ => {}
    }
}

/// Process audio in idle state (wake word detection)
fn process_idle_state(
    app_handle: &Option<AppHandle>,
    state: &Arc<RwLock<VoiceControllerState>>,
    wake_word_enabled: bool,
    samples: &[f32],
    wake_word_detector: &mut Option<WakeWordDetector>,
    vad: &mut VoiceActivityDetector,
) {
    if !wake_word_enabled {
        return;
    }

    if let Some(ref mut detector) = wake_word_detector {
        match detector.process_audio(samples) {
            Ok(Some(score)) => {
                if detector.is_detected(score) {
                    emit_debug_log(app_handle, "info", &format!("WAKE WORD! Score: {:.3}", score));
                    log::info!("Wake word detected! Score: {}", score);

                    let mut state_guard = state.write();
                    state_guard.state_machine.transition(VoiceEvent::WakeWordDetected);
                    let new_state = state_guard.state_machine.state();
                    drop(state_guard);

                    if let Some(ref handle) = app_handle {
                        let _ = handle.emit("voice-wake-word", serde_json::json!({ "score": score }));
                        let _ = handle.emit("voice-state-changed", new_state);
                    }

                    vad.reset();
                }
            }
            Ok(None) => {}
            Err(e) => {
                emit_debug_log(app_handle, "error", &format!("Wake word error: {}", e));
            }
        }
    }
}

/// Process audio in listening state (VAD for speech end)
fn process_listening_state(
    app_handle: &Option<AppHandle>,
    state: &Arc<RwLock<VoiceControllerState>>,
    samples: &[f32],
    wake_word_detector: &mut Option<WakeWordDetector>,
    vad: &mut VoiceActivityDetector,
) {
    state.write().state_machine.add_audio(samples);

    let vad_result = vad.process(samples);
    if vad_result == VadResult::SpeechEnd {
        log::info!("Speech end detected");

        let mut state_guard = state.write();
        let result = state_guard.state_machine.transition(VoiceEvent::VadSpeechEnd);
        let new_state = result.new_state;
        drop(state_guard);

        if let Some(ref handle) = app_handle {
            let _ = handle.emit("voice-state-changed", new_state);

            if let Some(StateAction::SendToStt(audio)) = result.action {
                let _ = handle.emit("voice-audio-captured", audio);
            }
        }

        vad.reset();

        if let Some(ref mut detector) = wake_word_detector {
            detector.reset();
        }
    }
}

/// Calculate RMS of audio samples
pub fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();
    (sum_squares / samples.len() as f32).sqrt()
}

/// Emit a debug log message to the frontend
pub fn emit_debug_log(app_handle: &Option<AppHandle>, level: &str, message: &str) {
    log::info!("[{}] {}", level, message);
    if let Some(ref handle) = app_handle {
        let _ = handle.emit("debug-log", serde_json::json!({
            "level": level,
            "message": message
        }));
    }
}
