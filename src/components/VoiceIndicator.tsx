/**
 * VoiceIndicator component - visual feedback for voice state
 */

import React from 'react';
import { useVoiceState, VoiceState } from '../hooks/useVoiceState';

interface VoiceIndicatorProps {
  /** Optional class name for styling */
  className?: string;
  /** Whether to show audio level visualization */
  showAudioLevel?: boolean;
}

const stateColors: Record<VoiceState, string> = {
  Idle: '#6b7280',      // gray
  Listening: '#22c55e', // green
  Transcribing: '#eab308', // yellow
  Processing: '#3b82f6', // blue
  Speaking: '#a855f7',   // purple
};

const stateLabels: Record<VoiceState, string> = {
  Idle: 'Ready',
  Listening: 'Listening...',
  Transcribing: 'Transcribing...',
  Processing: 'Thinking...',
  Speaking: 'Speaking...',
};

export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
  className = '',
  showAudioLevel = true,
}) => {
  const { state, isRunning, audioLevel, trigger, cancel, error } = useVoiceState();

  const color = stateColors[state];
  const label = stateLabels[state];

  // Scale audio level for visualization (0-1 range, amplified)
  const levelHeight = Math.min(100, audioLevel * 500);

  const handleClick = async () => {
    if (state === 'Idle') {
      await trigger();
    } else if (state === 'Listening' || state === 'Speaking') {
      await cancel();
    }
  };

  if (!isRunning) {
    return null;
  }

  return (
    <div className={`voice-indicator ${className}`} style={styles.container}>
      <button
        onClick={handleClick}
        style={{
          ...styles.button,
          borderColor: color,
          boxShadow: state !== 'Idle' ? `0 0 10px ${color}40` : 'none',
        }}
        title={state === 'Idle' ? 'Click to speak' : 'Click to cancel'}
      >
        <div style={styles.innerCircle}>
          {/* Microphone icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>

          {/* Audio level bar */}
          {showAudioLevel && state === 'Listening' && (
            <div style={styles.levelContainer}>
              <div
                style={{
                  ...styles.levelBar,
                  height: `${levelHeight}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          )}
        </div>
      </button>

      <span style={{ ...styles.label, color }}>{label}</span>

      {error && (
        <span style={styles.error}>{error}</span>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  button: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: '2px solid',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  innerCircle: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelContainer: {
    position: 'absolute',
    left: '100%',
    marginLeft: '8px',
    width: '4px',
    height: '24px',
    backgroundColor: '#e5e7eb',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  levelBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    transition: 'height 0.05s ease',
    borderRadius: '2px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 500,
  },
  error: {
    fontSize: '11px',
    color: '#ef4444',
    maxWidth: '150px',
    textAlign: 'center',
  },
};

export default VoiceIndicator;
