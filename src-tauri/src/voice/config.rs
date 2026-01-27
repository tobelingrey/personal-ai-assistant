//! Voice system configuration

/// Configuration for the voice system
#[derive(Debug, Clone)]
pub struct VoiceConfig {
    /// Sample rate for audio processing (OpenWakeWord expects 16kHz)
    pub sample_rate: u32,
    /// Number of samples per audio chunk (80ms at 16kHz = 1280 samples)
    pub chunk_size: usize,
    /// Number of mel frames to accumulate before inference
    pub mel_frame_count: usize,
    /// Wake word detection threshold (0.0 - 1.0)
    pub wake_word_threshold: f32,
    /// Sensitivity multiplier for wake word detection
    pub sensitivity: f32,
    /// Silence threshold for VAD (RMS level)
    pub silence_threshold: f32,
    /// Frames of silence before speech end detection
    pub silence_frames_threshold: usize,
}

impl Default for VoiceConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000,
            chunk_size: 1280,           // 80ms at 16kHz
            mel_frame_count: 76,        // OpenWakeWord expectation
            wake_word_threshold: 0.5,
            sensitivity: 1.0,
            silence_threshold: 0.01,
            silence_frames_threshold: 16, // ~1.3 seconds at 80ms chunks
        }
    }
}

impl VoiceConfig {
    /// Calculate effective threshold based on sensitivity
    pub fn effective_threshold(&self) -> f32 {
        self.wake_word_threshold / self.sensitivity
    }
}
