/**
 * useVoiceState hook - manages voice state and Tauri event listening
 */

import { useState, useEffect, useCallback } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export type VoiceState = 'Idle' | 'Listening' | 'Transcribing' | 'Processing' | 'Speaking';

interface WakeWordEvent {
  score: number;
}

export interface UseVoiceStateResult {
  /** Current voice state */
  state: VoiceState;
  /** Whether voice system is running */
  isRunning: boolean;
  /** Current audio level (RMS) */
  audioLevel: number;
  /** Last wake word detection score */
  lastWakeWordScore: number | null;
  /** Start the voice system */
  start: () => Promise<void>;
  /** Stop the voice system */
  stop: () => Promise<void>;
  /** Manually trigger listening (push-to-talk) */
  trigger: () => Promise<void>;
  /** Cancel current operation */
  cancel: () => Promise<void>;
  /** Error message if any */
  error: string | null;
}

export function useVoiceState(): UseVoiceStateResult {
  const [state, setState] = useState<VoiceState>('Idle');
  const [isRunning, setIsRunning] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastWakeWordScore, setLastWakeWordScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for Tauri events
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Voice state changes
      const unlistenState = await listen<VoiceState>('voice-state-changed', (event) => {
        setState(event.payload);
      });
      unlisteners.push(unlistenState);

      // Wake word detection
      const unlistenWakeWord = await listen<WakeWordEvent>('voice-wake-word', (event) => {
        setLastWakeWordScore(event.payload.score);
      });
      unlisteners.push(unlistenWakeWord);

      // Audio level updates
      const unlistenAudioLevel = await listen<number>('voice-audio-level', (event) => {
        setAudioLevel(event.payload);
      });
      unlisteners.push(unlistenAudioLevel);

      // Error events
      const unlistenError = await listen<string>('voice-error', (event) => {
        setError(event.payload);
      });
      unlisteners.push(unlistenError);
    };

    setupListeners();

    // Check initial state
    invoke<boolean>('is_voice_running')
      .then((running) => setIsRunning(running))
      .catch(() => {});

    invoke<VoiceState>('get_voice_state')
      .then((voiceState) => setState(voiceState))
      .catch(() => {});

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      await invoke('start_voice_listening');
      setIsRunning(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      setError(null);
      await invoke('stop_voice_listening');
      setIsRunning(false);
      setState('Idle');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    }
  }, []);

  const trigger = useCallback(async () => {
    try {
      setError(null);
      await invoke('trigger_voice_listening');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    }
  }, []);

  const cancel = useCallback(async () => {
    try {
      setError(null);
      await invoke('cancel_voice_operation');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    }
  }, []);

  return {
    state,
    isRunning,
    audioLevel,
    lastWakeWordScore,
    start,
    stop,
    trigger,
    cancel,
    error,
  };
}
