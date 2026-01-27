/**
 * DebugLog component - displays real-time debug logs at the bottom of the app
 */

import React, { useEffect, useRef } from 'react';
import { useDebugLog, LogEntry } from '../hooks/useDebugLog';
import { useVoiceState } from '../hooks/useVoiceState';
import './DebugLog.css';

interface DebugLogProps {
  maxHeight?: number;
}

const levelColors: Record<LogEntry['level'], string> = {
  debug: '#6b7280',
  info: '#3b82f6',
  warn: '#eab308',
  error: '#ef4444',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
}

export const DebugLog: React.FC<DebugLogProps> = ({ maxHeight = 150 }) => {
  const { logs, clearLogs, isEnabled, setIsEnabled, addLog } = useDebugLog();
  const { state, isRunning, start, stop, error } = useVoiceState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = React.useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  // Log voice state changes
  useEffect(() => {
    addLog('info', 'UI', `Voice running: ${isRunning}, state: ${state}`);
  }, [isRunning, state, addLog]);

  // Log errors
  useEffect(() => {
    if (error) {
      addLog('error', 'UI', `Voice error: ${error}`);
    }
  }, [error, addLog]);

  const handleStartStop = async () => {
    try {
      if (isRunning) {
        addLog('info', 'UI', 'Stopping voice system...');
        await stop();
        addLog('info', 'UI', 'Voice system stopped');
      } else {
        addLog('info', 'UI', 'Starting voice system...');
        await start();
        addLog('info', 'UI', 'Voice system started');
      }
    } catch (e) {
      addLog('error', 'UI', `Failed: ${e}`);
    }
  };

  return (
    <div className="debug-log-container">
      <div className="debug-log-header">
        <div className="debug-log-title">
          <button
            className="debug-log-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <span>Debug Log</span>
          <span className={`voice-status ${isRunning ? 'voice-status--active' : ''}`}>
            {isRunning ? `● ${state}` : '○ Stopped'}
          </span>
        </div>
        <div className="debug-log-actions">
          <button
            className={`voice-toggle-btn ${isRunning ? 'voice-toggle-btn--stop' : 'voice-toggle-btn--start'}`}
            onClick={handleStartStop}
          >
            {isRunning ? 'Stop Voice' : 'Start Voice'}
          </button>
          <label className="debug-log-checkbox">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            Log
          </label>
          <button className="debug-log-clear" onClick={clearLogs}>
            Clear
          </button>
        </div>
      </div>
      {isExpanded && (
        <div
          className="debug-log-content"
          ref={scrollRef}
          style={{ maxHeight }}
        >
          {logs.length === 0 ? (
            <div className="debug-log-empty">
              No logs yet. Click "Start Voice" to begin listening for wake word.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="debug-log-entry">
                <span className="debug-log-time">{formatTime(log.timestamp)}</span>
                <span
                  className="debug-log-level"
                  style={{ color: levelColors[log.level] }}
                >
                  [{log.level.toUpperCase()}]
                </span>
                <span className="debug-log-source">[{log.source}]</span>
                <span className="debug-log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DebugLog;
