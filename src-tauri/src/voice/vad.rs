//! Voice Activity Detection (VAD)
//!
//! Simple energy-based VAD for detecting speech end.
//! Can be upgraded to Silero VAD later.

use super::config::VoiceConfig;

/// Voice activity detector state
#[derive(Debug)]
pub struct VoiceActivityDetector {
    /// Energy threshold for silence detection
    silence_threshold: f32,
    /// Number of consecutive silent frames to trigger speech end
    silence_frames_threshold: usize,
    /// Current count of consecutive silent frames
    silent_frame_count: usize,
    /// Whether speech has been detected at all
    speech_detected: bool,
    /// Smoothed RMS level for more stable detection
    smoothed_rms: f32,
    /// Smoothing factor (0-1, higher = more smoothing)
    smoothing_factor: f32,
}

impl VoiceActivityDetector {
    /// Create a new VAD instance
    pub fn new(config: &VoiceConfig) -> Self {
        Self {
            silence_threshold: config.silence_threshold,
            silence_frames_threshold: config.silence_frames_threshold,
            silent_frame_count: 0,
            speech_detected: false,
            smoothed_rms: 0.0,
            smoothing_factor: 0.3,
        }
    }

    /// Process an audio chunk and return VAD result
    pub fn process(&mut self, samples: &[f32]) -> VadResult {
        let rms = calculate_rms(samples);

        // Smooth the RMS value
        self.smoothed_rms = self.smoothing_factor * rms
            + (1.0 - self.smoothing_factor) * self.smoothed_rms;

        let is_silent = self.smoothed_rms < self.silence_threshold;

        if !is_silent {
            // Speech detected
            self.speech_detected = true;
            self.silent_frame_count = 0;
            VadResult::Speech
        } else if self.speech_detected {
            // Silent frame after speech
            self.silent_frame_count += 1;

            if self.silent_frame_count >= self.silence_frames_threshold {
                // Enough silence after speech - speech ended
                VadResult::SpeechEnd
            } else {
                VadResult::Silence
            }
        } else {
            // Silent and no speech yet
            VadResult::Silence
        }
    }

    /// Reset the VAD state
    pub fn reset(&mut self) {
        self.silent_frame_count = 0;
        self.speech_detected = false;
        self.smoothed_rms = 0.0;
    }

    /// Get current RMS level (for debugging/visualization)
    pub fn current_rms(&self) -> f32 {
        self.smoothed_rms
    }

    /// Check if speech has been detected in current session
    pub fn has_speech(&self) -> bool {
        self.speech_detected
    }

    /// Get the number of consecutive silent frames
    pub fn silent_frames(&self) -> usize {
        self.silent_frame_count
    }
}

/// Result of VAD processing
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VadResult {
    /// Currently detecting speech
    Speech,
    /// Currently silent (but may still be mid-utterance)
    Silence,
    /// Speech has ended (sufficient silence after speech)
    SpeechEnd,
}

/// Calculate RMS (Root Mean Square) of audio samples
fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();
    (sum_squares / samples.len() as f32).sqrt()
}

/// Calculate peak amplitude of audio samples
#[allow(dead_code)]
fn calculate_peak(samples: &[f32]) -> f32 {
    samples
        .iter()
        .map(|s| s.abs())
        .max_by(|a, b| a.partial_cmp(b).unwrap())
        .unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_config() -> VoiceConfig {
        VoiceConfig {
            silence_threshold: 0.01,
            silence_frames_threshold: 3,
            ..Default::default()
        }
    }

    #[test]
    fn test_detect_silence() {
        let mut vad = VoiceActivityDetector::new(&make_config());
        let silent_samples = vec![0.0; 1280];
        let result = vad.process(&silent_samples);
        assert_eq!(result, VadResult::Silence);
    }

    #[test]
    fn test_detect_speech() {
        let mut vad = VoiceActivityDetector::new(&make_config());
        let loud_samples: Vec<f32> = (0..1280).map(|i| (i as f32 * 0.01).sin() * 0.5).collect();
        let result = vad.process(&loud_samples);
        assert_eq!(result, VadResult::Speech);
    }

    #[test]
    fn test_speech_end_detection() {
        let mut vad = VoiceActivityDetector::new(&make_config());

        // First, detect speech
        let loud_samples: Vec<f32> = (0..1280).map(|i| (i as f32 * 0.01).sin() * 0.5).collect();
        vad.process(&loud_samples);
        assert!(vad.has_speech());

        // Then silence frames
        let silent_samples = vec![0.0; 1280];
        vad.process(&silent_samples); // Frame 1
        vad.process(&silent_samples); // Frame 2
        let result = vad.process(&silent_samples); // Frame 3 - should trigger end

        assert_eq!(result, VadResult::SpeechEnd);
    }

    #[test]
    fn test_reset() {
        let mut vad = VoiceActivityDetector::new(&make_config());

        // Detect some speech
        let loud_samples: Vec<f32> = (0..1280).map(|i| (i as f32 * 0.01).sin() * 0.5).collect();
        vad.process(&loud_samples);
        assert!(vad.has_speech());

        // Reset
        vad.reset();
        assert!(!vad.has_speech());
        assert_eq!(vad.silent_frames(), 0);
    }

    #[test]
    fn test_rms_calculation() {
        let samples = vec![1.0, -1.0, 1.0, -1.0];
        let rms = calculate_rms(&samples);
        assert!((rms - 1.0).abs() < 0.001);
    }
}
