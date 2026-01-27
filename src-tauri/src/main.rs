// Jarvis Desktop Application
// Tauri shell wrapping the React frontend

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod voice;

use commands::voice::VoiceControllerState;

fn main() {
    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(VoiceControllerState::new())
        .invoke_handler(tauri::generate_handler![
            // Voice commands
            commands::voice::start_voice_listening,
            commands::voice::stop_voice_listening,
            commands::voice::trigger_voice_listening,
            commands::voice::cancel_voice_operation,
            commands::voice::set_wake_word_sensitivity,
            commands::voice::set_wake_word_enabled,
            commands::voice::check_wake_word_available,
            commands::voice::get_voice_state,
            commands::voice::is_voice_running,
            commands::voice::voice_transcription_complete,
            commands::voice::voice_response_ready,
            commands::voice::voice_speech_complete,
            // Audio device commands
            commands::voice::get_input_devices,
            commands::voice::get_output_devices,
            commands::voice::set_input_device,
            commands::voice::set_output_device,
            commands::voice::get_current_input_device,
            commands::voice::get_current_output_device,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Jarvis");
}
