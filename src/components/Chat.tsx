/**
 * Chat component - main chat interface
 */

import { useState, useRef, useEffect } from 'react';
import { useChat, type ChatMessage } from '../hooks/useChat';
import './Chat.css';

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className="message-content">
        {message.content}
        {message.isStreaming && <span className="cursor">▋</span>}
      </div>
      {message.brainResponse?.saved && (
        <div className="message-badge">Saved</div>
      )}
    </div>
  );
}

export function Chat() {
  const [input, setInput] = useState('');
  const { messages, isLoading, error, send, clear } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      send(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <p>Good day, sir. How may I assist you?</p>
            <div className="chat-suggestions">
              <button onClick={() => send('What can you help me with?')}>
                What can you do?
              </button>
              <button onClick={() => send('I had a sandwich for lunch')}>
                Log a meal
              </button>
              <button onClick={() => send('Remind me to call the dentist tomorrow')}>
                Create a reminder
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="chat-error">{error}</div>}

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Speak, sir..."
          disabled={isLoading}
        />
        <button
          type="submit"
          className="chat-send"
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? '...' : 'Send'}
        </button>
        {messages.length > 0 && (
          <button type="button" className="chat-clear" onClick={clear}>
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
