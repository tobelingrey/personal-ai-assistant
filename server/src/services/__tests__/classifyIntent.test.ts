/**
 * classifyIntent Tests
 *
 * Tests for quick intent classification.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

// Mock the ollama module before importing brain
vi.mock('../ollama.js', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
}));

// Import the mocked module
import * as ollama from '../ollama.js';

// Import after mocking
import { classifyIntent } from '../brain.js';

// Get typed mock references
const mockChat = ollama.chat as MockedFunction<typeof ollama.chat>;

beforeEach(() => {
  mockChat.mockReset();
});

describe('classifyIntent', () => {
  it('classifies food storage quickly', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'food',
        confidence: 0.9,
      })
    );

    const result = await classifyIntent('I ate a sandwich');

    expect(result.intent).toBe('store');
    expect(result.dataType).toBe('food');
    expect(result.confidence).toBe(0.9);
  });

  it('classifies query intent', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'query',
        dataType: 'task',
        confidence: 0.85,
      })
    );

    const result = await classifyIntent('What tasks do I have?');

    expect(result.intent).toBe('query');
    expect(result.dataType).toBe('task');
  });

  it('falls back on invalid response', async () => {
    mockChat.mockResolvedValueOnce('not valid json');

    const result = await classifyIntent('test message');

    expect(result.intent).toBe('conversation');
    expect(result.dataType).toBeNull();
    expect(result.confidence).toBe(0.3);
  });
});
