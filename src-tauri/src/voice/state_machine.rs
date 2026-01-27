//! Voice state machine for managing voice interaction flow

use serde::{Deserialize, Serialize};
use std::time::Instant;

/// Voice system states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VoiceState {
    /// Idle - listening for wake word
    Idle,
    /// Listening - wake word detected, capturing user speech
    Listening,
    /// Transcribing - sending audio to STT
    Transcribing,
    /// Processing - waiting for AI response
    Processing,
    /// Speaking - playing TTS response
    Speaking,
}

impl Default for VoiceState {
    fn default() -> Self {
        Self::Idle
    }
}

impl std::fmt::Display for VoiceState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VoiceState::Idle => write!(f, "Idle"),
            VoiceState::Listening => write!(f, "Listening"),
            VoiceState::Transcribing => write!(f, "Transcribing"),
            VoiceState::Processing => write!(f, "Processing"),
            VoiceState::Speaking => write!(f, "Speaking"),
        }
    }
}

/// Events that trigger state transitions
#[derive(Debug, Clone)]
pub enum VoiceEvent {
    /// Wake word was detected
    WakeWordDetected,
    /// User manually triggered listening (button press)
    ManualTrigger,
    /// VAD detected end of speech
    VadSpeechEnd,
    /// Transcription completed with text
    TranscriptionComplete(String),
    /// AI response is ready
    ResponseReady(String),
    /// TTS finished speaking
    SpeechComplete,
    /// User spoke during TTS (barge-in)
    BargeIn,
    /// Timeout occurred
    Timeout,
    /// An error occurred
    Error(String),
    /// Cancel current operation
    Cancel,
}

/// Result of a state transition
#[derive(Debug)]
pub struct TransitionResult {
    pub new_state: VoiceState,
    pub action: Option<StateAction>,
}

/// Actions to perform after state transition
#[derive(Debug, Clone)]
pub enum StateAction {
    /// Start audio capture for user speech
    StartCapture,
    /// Stop audio capture
    StopCapture,
    /// Send audio to STT service
    SendToStt(Vec<f32>),
    /// Send text to AI for processing
    ProcessText(String),
    /// Play TTS response
    PlayTts(String),
    /// Stop TTS playback
    StopTts,
    /// Emit error event
    EmitError(String),
}

/// Voice state machine
#[derive(Debug)]
pub struct VoiceStateMachine {
    state: VoiceState,
    last_transition: Instant,
    captured_audio: Vec<f32>,
}

impl Default for VoiceStateMachine {
    fn default() -> Self {
        Self::new()
    }
}

impl VoiceStateMachine {
    pub fn new() -> Self {
        Self {
            state: VoiceState::Idle,
            last_transition: Instant::now(),
            captured_audio: Vec::new(),
        }
    }

    /// Get current state
    pub fn state(&self) -> VoiceState {
        self.state
    }

    /// Get time since last transition
    pub fn time_in_state(&self) -> std::time::Duration {
        self.last_transition.elapsed()
    }

    /// Add audio samples during Listening state
    pub fn add_audio(&mut self, samples: &[f32]) {
        if self.state == VoiceState::Listening {
            self.captured_audio.extend_from_slice(samples);
        }
    }

    /// Process an event and return the transition result
    pub fn transition(&mut self, event: VoiceEvent) -> TransitionResult {
        let (new_state, action) = match (&self.state, event) {
            // From Idle
            (VoiceState::Idle, VoiceEvent::WakeWordDetected) => {
                self.captured_audio.clear();
                (VoiceState::Listening, Some(StateAction::StartCapture))
            }
            (VoiceState::Idle, VoiceEvent::ManualTrigger) => {
                self.captured_audio.clear();
                (VoiceState::Listening, Some(StateAction::StartCapture))
            }

            // From Listening
            (VoiceState::Listening, VoiceEvent::VadSpeechEnd) => {
                let audio = std::mem::take(&mut self.captured_audio);
                (VoiceState::Transcribing, Some(StateAction::SendToStt(audio)))
            }
            (VoiceState::Listening, VoiceEvent::Timeout) => {
                self.captured_audio.clear();
                (VoiceState::Idle, Some(StateAction::StopCapture))
            }
            (VoiceState::Listening, VoiceEvent::Cancel) => {
                self.captured_audio.clear();
                (VoiceState::Idle, Some(StateAction::StopCapture))
            }

            // From Transcribing
            (VoiceState::Transcribing, VoiceEvent::TranscriptionComplete(text)) => {
                (VoiceState::Processing, Some(StateAction::ProcessText(text)))
            }
            (VoiceState::Transcribing, VoiceEvent::Error(e)) => {
                (VoiceState::Idle, Some(StateAction::EmitError(e)))
            }

            // From Processing
            (VoiceState::Processing, VoiceEvent::ResponseReady(response)) => {
                (VoiceState::Speaking, Some(StateAction::PlayTts(response)))
            }
            (VoiceState::Processing, VoiceEvent::Error(e)) => {
                (VoiceState::Idle, Some(StateAction::EmitError(e)))
            }

            // From Speaking
            (VoiceState::Speaking, VoiceEvent::SpeechComplete) => {
                (VoiceState::Idle, None)
            }
            (VoiceState::Speaking, VoiceEvent::BargeIn) => {
                self.captured_audio.clear();
                (VoiceState::Listening, Some(StateAction::StopTts))
            }
            (VoiceState::Speaking, VoiceEvent::Cancel) => {
                (VoiceState::Idle, Some(StateAction::StopTts))
            }

            // Global error handling
            (_, VoiceEvent::Error(e)) => {
                self.captured_audio.clear();
                (VoiceState::Idle, Some(StateAction::EmitError(e)))
            }

            // Invalid transitions - stay in current state
            (current, _) => (*current, None),
        };

        if new_state != self.state {
            self.state = new_state;
            self.last_transition = Instant::now();
            log::debug!("Voice state transition: {:?} -> {:?}", self.state, new_state);
        }

        TransitionResult { new_state, action }
    }

    /// Force reset to Idle state
    pub fn reset(&mut self) {
        self.state = VoiceState::Idle;
        self.last_transition = Instant::now();
        self.captured_audio.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let sm = VoiceStateMachine::new();
        assert_eq!(sm.state(), VoiceState::Idle);
    }

    #[test]
    fn test_wake_word_transition() {
        let mut sm = VoiceStateMachine::new();
        let result = sm.transition(VoiceEvent::WakeWordDetected);
        assert_eq!(result.new_state, VoiceState::Listening);
        assert!(matches!(result.action, Some(StateAction::StartCapture)));
    }

    #[test]
    fn test_manual_trigger() {
        let mut sm = VoiceStateMachine::new();
        let result = sm.transition(VoiceEvent::ManualTrigger);
        assert_eq!(result.new_state, VoiceState::Listening);
    }

    #[test]
    fn test_full_flow() {
        let mut sm = VoiceStateMachine::new();

        // Wake word -> Listening
        sm.transition(VoiceEvent::WakeWordDetected);
        assert_eq!(sm.state(), VoiceState::Listening);

        // VAD end -> Transcribing
        sm.transition(VoiceEvent::VadSpeechEnd);
        assert_eq!(sm.state(), VoiceState::Transcribing);

        // Transcription done -> Processing
        sm.transition(VoiceEvent::TranscriptionComplete("hello".to_string()));
        assert_eq!(sm.state(), VoiceState::Processing);

        // Response ready -> Speaking
        sm.transition(VoiceEvent::ResponseReady("Hi there".to_string()));
        assert_eq!(sm.state(), VoiceState::Speaking);

        // Speech done -> Idle
        sm.transition(VoiceEvent::SpeechComplete);
        assert_eq!(sm.state(), VoiceState::Idle);
    }

    #[test]
    fn test_barge_in() {
        let mut sm = VoiceStateMachine::new();
        sm.transition(VoiceEvent::WakeWordDetected);
        sm.transition(VoiceEvent::VadSpeechEnd);
        sm.transition(VoiceEvent::TranscriptionComplete("test".to_string()));
        sm.transition(VoiceEvent::ResponseReady("response".to_string()));

        // Barge in during speaking
        let result = sm.transition(VoiceEvent::BargeIn);
        assert_eq!(result.new_state, VoiceState::Listening);
        assert!(matches!(result.action, Some(StateAction::StopTts)));
    }

    #[test]
    fn test_timeout() {
        let mut sm = VoiceStateMachine::new();
        sm.transition(VoiceEvent::WakeWordDetected);

        let result = sm.transition(VoiceEvent::Timeout);
        assert_eq!(result.new_state, VoiceState::Idle);
    }

    #[test]
    fn test_error_resets_to_idle() {
        let mut sm = VoiceStateMachine::new();
        sm.transition(VoiceEvent::WakeWordDetected);
        sm.transition(VoiceEvent::VadSpeechEnd);

        let result = sm.transition(VoiceEvent::Error("test error".to_string()));
        assert_eq!(result.new_state, VoiceState::Idle);
    }
}
