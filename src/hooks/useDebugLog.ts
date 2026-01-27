/**
 * useDebugLog hook - captures and stores debug log messages
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
}

export interface UseDebugLogResult {
  logs: LogEntry[];
  addLog: (level: LogEntry['level'], source: string, message: string) => void;
  clearLogs: () => void;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}

const MAX_LOGS = 200;

export function useDebugLog(): UseDebugLogResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const idCounter = useRef(0);

  const addLog = useCallback((level: LogEntry['level'], source: string, message: string) => {
    const entry: LogEntry = {
      id: idCounter.current++,
      timestamp: new Date(),
      level,
      source,
      message,
    };

    setLogs((prev) => {
      const newLogs = [...prev, entry];
      // Keep only the last MAX_LOGS entries
      if (newLogs.length > MAX_LOGS) {
        return newLogs.slice(-MAX_LOGS);
      }
      return newLogs;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Listen for various Tauri events and log them
  useEffect(() => {
    if (!isEnabled) return;

    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Voice state changes
      const unlistenState = await listen<string>('voice-state-changed', (event) => {
        addLog('info', 'Voice', `State changed to: ${event.payload}`);
      });
      unlisteners.push(unlistenState);

      // Wake word detection
      const unlistenWakeWord = await listen<{ score: number }>('voice-wake-word', (event) => {
        addLog('info', 'WakeWord', `Detected! Score: ${event.payload.score.toFixed(3)}`);
      });
      unlisteners.push(unlistenWakeWord);

      // Audio level (throttled)
      let lastAudioLog = 0;
      const unlistenAudioLevel = await listen<number>('voice-audio-level', (event) => {
        const now = Date.now();
        // Only log every 500ms to avoid spam
        if (now - lastAudioLog > 500 && event.payload > 0.01) {
          lastAudioLog = now;
          addLog('debug', 'Audio', `Level: ${event.payload.toFixed(4)}`);
        }
      });
      unlisteners.push(unlistenAudioLevel);

      // Voice errors
      const unlistenError = await listen<string>('voice-error', (event) => {
        addLog('error', 'Voice', event.payload);
      });
      unlisteners.push(unlistenError);

      // Audio captured
      const unlistenCaptured = await listen<number[]>('voice-audio-captured', (event) => {
        addLog('info', 'Voice', `Audio captured: ${event.payload.length} samples`);
      });
      unlisteners.push(unlistenCaptured);

      // Debug log from Rust
      const unlistenDebug = await listen<{ level: string; message: string }>('debug-log', (event) => {
        const level = event.payload.level as LogEntry['level'];
        addLog(level, 'Rust', event.payload.message);
      });
      unlisteners.push(unlistenDebug);

      addLog('info', 'System', 'Debug log initialized, listening for events...');
    };

    setupListeners();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [isEnabled, addLog]);

  return {
    logs,
    addLog,
    clearLogs,
    isEnabled,
    setIsEnabled,
  };
}
