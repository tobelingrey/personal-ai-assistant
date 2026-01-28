//! Voice module - wake word detection, audio capture, and state management

pub mod audio_capture;
pub mod audio_processing;
pub mod buffer;
pub mod config;
pub mod controller;
pub mod state_machine;
pub mod vad;
pub mod wake_word;

use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use thiserror::Error;

pub use audio_capture::{list_input_devices, list_output_devices, AudioCapture, AudioDeviceInfo};
pub use config::VoiceConfig;
pub use controller::VoiceController;
pub use state_machine::{VoiceEvent, VoiceState, VoiceStateMachine};

use audio_capture::AudioCaptureError;
use wake_word::WakeWordError;

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
