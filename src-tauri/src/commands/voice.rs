//! Voice-related Tauri commands

use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::voice::{
    get_models_dir, list_input_devices, list_output_devices, AudioDeviceInfo, VoiceController,
    VoiceState,
};

/// Managed state for the voice controller
pub struct VoiceControllerState(pub Arc<Mutex<Option<VoiceController>>>);

impl VoiceControllerState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

impl Default for VoiceControllerState {
    fn default() -> Self {
        Self::new()
    }
}

/// Initialize and start voice listening
#[tauri::command]
pub async fn start_voice_listening(
    app: AppHandle,
    state: State<'_, VoiceControllerState>,
) -> Result<(), String> {
    let models_dir = get_models_dir(&app);

    let mut guard = state.0.lock();

    // If controller exists and is running, just return
    if let Some(ref controller) = *guard {
        if controller.is_running() {
            return Ok(());
        }
    }

    // Create new controller
    let mut controller = VoiceController::new(models_dir);
    controller.set_app_handle(app.clone());

    // Start the voice system
    controller.start().map_err(|e| e.to_string())?;

    *guard = Some(controller);

    log::info!("Voice listening started");
    Ok(())
}

/// Stop voice listening
#[tauri::command]
pub async fn stop_voice_listening(state: State<'_, VoiceControllerState>) -> Result<(), String> {
    let mut guard = state.0.lock();

    if let Some(ref mut controller) = *guard {
        controller.stop();
    }

    *guard = None;

    log::info!("Voice listening stopped");
    Ok(())
}

/// Manually trigger listening (push-to-talk)
#[tauri::command]
pub async fn trigger_voice_listening(
    state: State<'_, VoiceControllerState>,
) -> Result<(), String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.manual_trigger();
        Ok(())
    } else {
        Err("Voice system not started".to_string())
    }
}

/// Cancel current voice operation
#[tauri::command]
pub async fn cancel_voice_operation(state: State<'_, VoiceControllerState>) -> Result<(), String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.cancel();
        Ok(())
    } else {
        Err("Voice system not started".to_string())
    }
}

/// Set wake word detection sensitivity
#[tauri::command]
pub async fn set_wake_word_sensitivity(
    sensitivity: f32,
    state: State<'_, VoiceControllerState>,
) -> Result<(), String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.set_sensitivity(sensitivity);
        Ok(())
    } else {
        Err("Voice system not started".to_string())
    }
}

/// Enable or disable wake word detection
#[tauri::command]
pub async fn set_wake_word_enabled(
    enabled: bool,
    state: State<'_, VoiceControllerState>,
) -> Result<(), String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.set_wake_word_enabled(enabled);
        Ok(())
    } else {
        Err("Voice system not started".to_string())
    }
}

/// Check if wake word detection is available (always true for OpenWakeWord)
#[tauri::command]
pub fn check_wake_word_available() -> bool {
    // OpenWakeWord doesn't require API keys
    true
}

/// Get current voice state
#[tauri::command]
pub fn get_voice_state(state: State<'_, VoiceControllerState>) -> VoiceState {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.current_state()
    } else {
        VoiceState::Idle
    }
}

/// Check if voice system is running
#[tauri::command]
pub fn is_voice_running(state: State<'_, VoiceControllerState>) -> bool {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.is_running()
    } else {
        false
    }
}

/// Notify that transcription is complete (called from frontend after STT)
#[tauri::command]
pub async fn voice_transcription_complete(
    text: String,
    state: State<'_, VoiceControllerState>,
) -> Result<(), String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.transcription_complete(text);
        Ok(())
    } else {
        Err("Voice system not started".to_string())
    }
}

/// Notify that AI response is ready (called from frontend after processing)
#[tauri::command]
pub async fn voice_response_ready(
    response: String,
    state: State<'_, VoiceControllerState>,
) -> Result<(), String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.response_ready(response);
        Ok(())
    } else {
        Err("Voice system not started".to_string())
    }
}

/// Notify that TTS is complete (called from frontend after speaking)
#[tauri::command]
pub async fn voice_speech_complete(
    state: State<'_, VoiceControllerState>,
) -> Result<(), String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.speech_complete();
        Ok(())
    } else {
        Err("Voice system not started".to_string())
    }
}

/// List available input (microphone) devices
#[tauri::command]
pub fn get_input_devices() -> Vec<AudioDeviceInfo> {
    list_input_devices()
}

/// List available output (speaker) devices
#[tauri::command]
pub fn get_output_devices() -> Vec<AudioDeviceInfo> {
    list_output_devices()
}

/// Set the input device to use (requires restart of voice system)
#[tauri::command]
pub async fn set_input_device(
    device_name: Option<String>,
    state: State<'_, VoiceControllerState>,
) -> Result<(), String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.set_input_device(device_name);
        Ok(())
    } else {
        // Store preference for when controller starts
        // For now, just return Ok - preference will be applied on next start
        Ok(())
    }
}

/// Set the output device to use
#[tauri::command]
pub async fn set_output_device(
    device_name: Option<String>,
    state: State<'_, VoiceControllerState>,
) -> Result<(), String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.set_output_device(device_name);
        Ok(())
    } else {
        Ok(())
    }
}

/// Get current input device
#[tauri::command]
pub fn get_current_input_device(state: State<'_, VoiceControllerState>) -> Option<String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.get_input_device()
    } else {
        None
    }
}

/// Get current output device
#[tauri::command]
pub fn get_current_output_device(state: State<'_, VoiceControllerState>) -> Option<String> {
    let guard = state.0.lock();

    if let Some(ref controller) = *guard {
        controller.get_output_device()
    } else {
        None
    }
}
