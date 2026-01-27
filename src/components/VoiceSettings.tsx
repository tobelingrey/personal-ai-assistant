/**
 * VoiceSettings modal - TTS and wake word configuration
 */

import { useEffect, useCallback } from 'react';
import { useVoiceSettings } from '../hooks/useVoiceSettings';
import { useAudioDevices } from '../hooks/useAudioDevices';
import './VoiceSettings.css';

interface VoiceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`toggle ${checked ? 'toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

export function VoiceSettings({ isOpen, onClose }: VoiceSettingsProps) {
  const {
    settings,
    setTtsEnabled,
    setWakeWordEnabled,
    setWakeWordSensitivity,
    hasAccessKey,
  } = useVoiceSettings();

  const {
    inputDevices,
    outputDevices,
    selectedInputDevice,
    selectedOutputDevice,
    setInputDevice,
    setOutputDevice,
    refreshDevices,
  } = useAudioDevices();

  const accessKeyAvailable = hasAccessKey();

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="voice-settings-overlay" onClick={onClose}>
      <div
        className="voice-settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-settings-title"
      >
        <div className="voice-settings-header">
          <h2 id="voice-settings-title">Voice Settings</h2>
          <button
            className="voice-settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="voice-settings-content">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Text-to-Speech</span>
              <span className="setting-description">
                Enable voice responses from Jarvis
              </span>
            </div>
            <Toggle
              checked={settings.ttsEnabled}
              onChange={setTtsEnabled}
            />
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Wake Word</span>
              <span className="setting-description">
                {accessKeyAvailable
                  ? 'Say "Jarvis" to activate'
                  : 'Requires Picovoice access key'}
              </span>
            </div>
            <Toggle
              checked={settings.wakeWordEnabled}
              onChange={setWakeWordEnabled}
              disabled={!accessKeyAvailable}
            />
          </div>

          <div className={`setting-row setting-row--slider ${!settings.wakeWordEnabled || !accessKeyAvailable ? 'setting-row--disabled' : ''}`}>
            <div className="setting-info">
              <span className="setting-label">Wake Word Sensitivity</span>
              <span className="setting-description">
                {Math.round(settings.wakeWordSensitivity * 100)}% - {settings.wakeWordSensitivity < 0.3 ? 'Less sensitive' : settings.wakeWordSensitivity > 0.7 ? 'More sensitive' : 'Balanced'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.wakeWordSensitivity}
              onChange={(e) => setWakeWordSensitivity(parseFloat(e.target.value))}
              disabled={!settings.wakeWordEnabled || !accessKeyAvailable}
              className="sensitivity-slider"
            />
          </div>

          <div className="setting-section-divider" />

          <div className="setting-section-header">
            <span>Audio Devices</span>
            <button
              className="refresh-devices-btn"
              onClick={refreshDevices}
              aria-label="Refresh devices"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Microphone</span>
              <span className="setting-description">
                Input device for voice commands
              </span>
            </div>
            <select
              className="device-select"
              value={selectedInputDevice || ''}
              onChange={(e) => setInputDevice(e.target.value || null)}
            >
              <option value="">System Default</option>
              {inputDevices.map((device) => (
                <option key={device.name} value={device.name}>
                  {device.name} {device.is_default ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Speaker</span>
              <span className="setting-description">
                Output device for voice responses
              </span>
            </div>
            <select
              className="device-select"
              value={selectedOutputDevice || ''}
              onChange={(e) => setOutputDevice(e.target.value || null)}
            >
              <option value="">System Default</option>
              {outputDevices.map((device) => (
                <option key={device.name} value={device.name}>
                  {device.name} {device.is_default ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-note">
            Note: Changes to audio devices take effect after restarting voice listening.
          </div>
        </div>
      </div>
    </div>
  );
}
