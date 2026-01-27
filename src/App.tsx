import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Chat } from './components/Chat';
import { VoiceSettings } from './components/VoiceSettings';
import { VoiceIndicator } from './components/VoiceIndicator';
import { EvolutionPanel } from './components/evolution';
import { DebugLog } from './components/DebugLog';
import './App.css';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);

  // Auto-start voice system on mount with a delay for Tauri initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      invoke('start_voice_listening').catch((err) => {
        console.warn('Failed to auto-start voice system:', err);
      });
    }, 1000); // 1 second delay for Tauri to initialize

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>J.A.R.V.I.S.</h1>
        <div className="header-actions">
          <VoiceIndicator />
          <button
            className="settings-button"
            onClick={() => setIsEvolutionOpen(true)}
            aria-label="Open evolution panel"
            title="Self-Evolution"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </button>
          <button
            className="settings-button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
            title="Voice Settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
          <span className="status-indicator" title="System Status">●</span>
        </div>
      </header>
      <main className="app-main">
        <Chat />
      </main>
      <VoiceSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <EvolutionPanel
        isOpen={isEvolutionOpen}
        onClose={() => setIsEvolutionOpen(false)}
      />
      <DebugLog />
    </div>
  );
}

export default App;
