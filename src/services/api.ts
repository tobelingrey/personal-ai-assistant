/**
 * Backend API client
 *
 * Communicates with the Express backend for chat and data operations.
 */

const API_BASE = 'http://localhost:3001';

export interface BrainResponse {
  intent: 'store' | 'query' | 'conversation';
  dataType: 'food' | 'task' | 'entity' | 'transaction' | null;
  extracted: Record<string, unknown> | null;
  missingFields: string[];
  response: string;
  followUpQuestion: string | null;
  confidence: number;
  saved?: boolean;
  savedId?: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    database: { connected: boolean };
    ollama: { available: boolean; modelLoaded: boolean; error?: string };
  };
}

/**
 * Check server health status
 */
export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json() as Promise<HealthStatus>;
}

/**
 * Send a chat message (non-streaming)
 */
export async function sendMessage(message: string): Promise<BrainResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, stream: false }),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  return response.json() as Promise<BrainResponse>;
}

/**
 * Stream chat response via SSE
 */
export function streamMessage(
  message: string,
  onToken: (token: string) => void,
  onComplete: (response: BrainResponse) => void,
  onError: (error: Error) => void
): () => void {
  const abortController = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, stream: true }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data) as {
                type: string;
                content?: string;
                brainResponse?: BrainResponse;
              };

              if (parsed.type === 'token' && parsed.content) {
                onToken(parsed.content);
              } else if (parsed.type === 'complete' && parsed.brainResponse) {
                onComplete(parsed.brainResponse);
              } else if (parsed.type === 'error') {
                onError(new Error('Server error'));
              }
            } catch {
              // Ignore parse errors for partial data
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  })();

  return () => abortController.abort();
}

/**
 * Get conversation history
 */
export async function getHistory(): Promise<{ messages: Message[]; count: number }> {
  const response = await fetch(`${API_BASE}/chat/history`);
  if (!response.ok) {
    throw new Error(`Failed to get history: ${response.status}`);
  }
  return response.json() as Promise<{ messages: Message[]; count: number }>;
}

/**
 * Clear conversation history
 */
export async function clearHistory(): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/history`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to clear history: ${response.status}`);
  }
}
