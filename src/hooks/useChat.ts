/**
 * useChat hook - manages chat state and SSE streaming
 */

import { useState, useCallback, useRef } from 'react';
import { sendMessage, streamMessage, type BrainResponse } from '../services/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  brainResponse?: BrainResponse;
}

export interface UseChatOptions {
  streaming?: boolean;
}

export function useChat(options: UseChatOptions = {}) {
  const { streaming = true } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setError(null);
      setIsLoading(true);

      // Add user message
      addMessage({ role: 'user', content: text });

      if (streaming) {
        // Create placeholder for assistant message
        const assistantId = addMessage({
          role: 'assistant',
          content: '',
          isStreaming: true,
        });

        let accumulated = '';

        abortRef.current = streamMessage(
          text,
          // onToken
          (token) => {
            accumulated += token;
            updateMessage(assistantId, { content: accumulated });
          },
          // onComplete
          (brainResponse) => {
            updateMessage(assistantId, {
              content: brainResponse.response,
              isStreaming: false,
              brainResponse,
            });
            setIsLoading(false);
          },
          // onError
          (err) => {
            setError(err.message);
            updateMessage(assistantId, {
              content: "I'm afraid something went wrong, sir.",
              isStreaming: false,
            });
            setIsLoading(false);
          }
        );
      } else {
        try {
          const response = await sendMessage(text);
          addMessage({
            role: 'assistant',
            content: response.response,
            brainResponse: response,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          addMessage({
            role: 'assistant',
            content: "I'm afraid something went wrong, sir.",
          });
        } finally {
          setIsLoading(false);
        }
      }
    },
    [streaming, isLoading, addMessage, updateMessage]
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    send,
    stop,
    clear,
  };
}
