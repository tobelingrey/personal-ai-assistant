/**
 * useVoiceSettings hook - manages voice settings with localStorage persistence
 * and Tauri backend integration
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface VoiceSettings {
  ttsEnabled: boolean;
  wakeWordEnabled: boolean;
  wakeWordSensitivity: number; // 0.0 - 1.0
}

const STORAGE_KEY = 'jarvis:voiceSettings';

const DEFAULT_SETTINGS: VoiceSettings = {
  ttsEnabled: true,
  wakeWordEnabled: true,
  wakeWordSensitivity: 0.5,
};

function loadSettings(): VoiceSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(loadSettings);

  // Persist on each change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const setTtsEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, ttsEnabled: enabled }));
  }, []);

  const setWakeWordEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, wakeWordEnabled: enabled }));
    // Sync with Tauri backend
    invoke('set_wake_word_enabled', { enabled }).catch(() => {});
  }, []);

  const setWakeWordSensitivity = useCallback((sensitivity: number) => {
    // Clamp frontend value to 0.0 - 1.0
    const clamped = Math.max(0, Math.min(1, sensitivity));
    setSettings((prev) => ({ ...prev, wakeWordSensitivity: clamped }));
    // Map frontend 0-1 to backend 0.5-2.5 for proper sensitivity scaling
    // Formula: backendSensitivity = 0.5 + (sliderValue * 2.0)
    // - 0% (0.0) → 0.5 (less sensitive, higher threshold)
    // - 100% (1.0) → 2.5 (more sensitive, lower threshold)
    const backendSensitivity = 0.5 + (clamped * 2.0);
    // Sync with Tauri backend
    invoke('set_wake_word_sensitivity', { sensitivity: backendSensitivity }).catch(() => {});
  }, []);

  // Check if wake word is available (OpenWakeWord doesn't need API key)
  const [wakeWordAvailable, setWakeWordAvailable] = useState(false);

  useEffect(() => {
    invoke<boolean>('check_wake_word_available')
      .then((available: boolean) => setWakeWordAvailable(available))
      .catch(() => setWakeWordAvailable(false));
  }, []);

  const hasAccessKey = useCallback(() => {
    return wakeWordAvailable;
  }, [wakeWordAvailable]);

  return {
    settings,
    setTtsEnabled,
    setWakeWordEnabled,
    setWakeWordSensitivity,
    hasAccessKey,
  };
}
