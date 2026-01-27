/**
 * Ollama client service
 *
 * Handles communication with the local Ollama instance for LLM operations.
 * All LLM calls go through this service.
 */

import { Ollama } from 'ollama';
import { config } from '../config.js';

const ollama = new Ollama({ host: config.ollamaHost });

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  done: boolean;
}

/**
 * Send a chat message and get a complete response
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const response = await ollama.chat({
    model: options.model ?? config.ollamaModel,
    messages,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
    },
  });

  return response.message.content;
}

/**
 * Send a chat message and stream the response
 * Yields partial content as it arrives
 */
export async function* chatStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): AsyncGenerator<ChatResponse> {
  const response = await ollama.chat({
    model: options.model ?? config.ollamaModel,
    messages,
    stream: true,
    options: {
      temperature: options.temperature ?? 0.7,
    },
  });

  for await (const part of response) {
    yield {
      content: part.message.content,
      done: part.done,
    };
  }
}

/**
 * Generate embeddings for text (for future vector search)
 */
export async function embed(text: string): Promise<number[]> {
  const response = await ollama.embeddings({
    model: 'nomic-embed-text', // Standard embedding model
    prompt: text,
  });

  return response.embedding;
}

/**
 * Check if Ollama is available and the model is loaded
 */
export async function checkHealth(): Promise<{
  available: boolean;
  modelLoaded: boolean;
  error?: string;
}> {
  try {
    // Check if Ollama is running
    const models = await ollama.list();

    // Check if our model is available
    const modelLoaded = models.models.some(
      (m) => m.name === config.ollamaModel || m.name.startsWith(config.ollamaModel.split(':')[0]!)
    );

    return {
      available: true,
      modelLoaded,
    };
  } catch (error) {
    return {
      available: false,
      modelLoaded: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Pull a model if not already available
 */
export async function ensureModel(modelName: string = config.ollamaModel): Promise<void> {
  const health = await checkHealth();

  if (!health.available) {
    throw new Error('Ollama is not running. Please start Ollama first.');
  }

  if (!health.modelLoaded) {
    console.log(`[Ollama] Pulling model ${modelName}...`);
    await ollama.pull({ model: modelName });
    console.log(`[Ollama] Model ${modelName} ready`);
  }
}
