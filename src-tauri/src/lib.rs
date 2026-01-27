//! Jarvis library module
//! Voice state machine, audio handling, and ONNX wake word detection

pub mod commands;
pub mod voice;

// Re-export commonly used types
pub use voice::{VoiceConfig, VoiceController, VoiceState};
