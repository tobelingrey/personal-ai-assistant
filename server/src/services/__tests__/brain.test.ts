/**
 * Brain Module Tests
 *
 * Tests for classification and extraction logic in brain.ts
 * Uses mocked LLM responses for deterministic testing.
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
import { parseResponse, processMessage, classifyIntent, processMessageStream } from '../brain.js';
import type { BrainResponse } from '../../types/schema.js';

// Get typed mock references
const mockChat = ollama.chat as MockedFunction<typeof ollama.chat>;
const mockChatStream = ollama.chatStream as MockedFunction<typeof ollama.chatStream>;

beforeEach(() => {
  mockChat.mockReset();
  mockChatStream.mockReset();
});

// ============================================================================
// A. parseResponse Unit Tests (no mocking needed)
// ============================================================================

describe('parseResponse', () => {
  describe('valid JSON parsing', () => {
    it('parses complete valid JSON', () => {
      const json = JSON.stringify({
        intent: 'store',
        dataType: 'food',
        extracted: { foodName: 'pizza', mealType: 'lunch' },
        missingFields: [],
        response: 'Logged your lunch, sir.',
        confidence: 0.95,
      });

      const result = parseResponse(json);

      expect(result.intent).toBe('store');
      expect(result.dataType).toBe('food');
      expect(result.extracted).toEqual({ foodName: 'pizza', mealType: 'lunch' });
      expect(result.missingFields).toEqual([]);
      expect(result.response).toBe('Logged your lunch, sir.');
      expect(result.confidence).toBe(0.95);
    });

    it('parses JSON with null dataType', () => {
      const json = JSON.stringify({
        intent: 'conversation',
        dataType: null,
        extracted: null,
        missingFields: [],
        response: 'Hello, sir.',
        confidence: 0.9,
      });

      const result = parseResponse(json);

      expect(result.intent).toBe('conversation');
      expect(result.dataType).toBeNull();
      expect(result.extracted).toBeNull();
    });
  });

  describe('markdown code block stripping', () => {
    it('strips ```json prefix and ``` suffix', () => {
      const wrapped = '```json\n{"intent":"store","dataType":"food","extracted":{"foodName":"pizza"},"missingFields":[],"response":"Done","confidence":0.9}\n```';

      const result = parseResponse(wrapped);

      expect(result.intent).toBe('store');
      expect(result.dataType).toBe('food');
    });

    it('strips bare ``` prefix and suffix', () => {
      const wrapped = '```\n{"intent":"query","dataType":"task","extracted":null,"missingFields":[],"response":"Looking...","confidence":0.8}\n```';

      const result = parseResponse(wrapped);

      expect(result.intent).toBe('query');
      expect(result.dataType).toBe('task');
    });

    it('handles mixed whitespace around code blocks', () => {
      const wrapped = '  ```json\n{"intent":"store"}\n```  ';

      const result = parseResponse(wrapped);

      expect(result.intent).toBe('store');
    });
  });

  describe('malformed JSON fallback', () => {
    it('falls back to conversation on invalid JSON', () => {
      const result = parseResponse('not json at all');

      expect(result.intent).toBe('conversation');
      expect(result.dataType).toBeNull();
      expect(result.extracted).toBeNull();
      expect(result.missingFields).toEqual([]);
      expect(result.confidence).toBe(0.3);
      expect(result.response).toBe('not json at all');
    });

    it('falls back on partial JSON', () => {
      const result = parseResponse('{"intent": "store", "dataType":');

      expect(result.intent).toBe('conversation');
      expect(result.confidence).toBe(0.3);
    });

    it('falls back on empty string', () => {
      const result = parseResponse('');

      expect(result.intent).toBe('conversation');
      expect(result.response).toBe("I'm afraid I couldn't process that, sir.");
    });
  });

  describe('missing fields get defaults', () => {
    it('defaults intent to conversation when missing', () => {
      const result = parseResponse('{"dataType":"food","response":"ok"}');

      expect(result.intent).toBe('conversation');
    });

    it('defaults dataType to null when missing', () => {
      const result = parseResponse('{"intent":"store","response":"ok"}');

      expect(result.dataType).toBeNull();
    });

    it('defaults missingFields to empty array when missing', () => {
      const result = parseResponse('{"intent":"store","response":"ok"}');

      expect(result.missingFields).toEqual([]);
    });

    it('defaults confidence to 0.5 when missing', () => {
      const result = parseResponse('{"intent":"store","response":"ok"}');

      expect(result.confidence).toBe(0.5);
    });

    it('defaults response to fallback message when missing', () => {
      const result = parseResponse('{"intent":"store"}');

      expect(result.response).toBe("I'm afraid I couldn't process that, sir.");
    });

    it('defaults extracted to null when missing', () => {
      const result = parseResponse('{"intent":"store","response":"ok"}');

      expect(result.extracted).toBeNull();
    });

    it('defaults followUpQuestion to null when missing', () => {
      const result = parseResponse('{"intent":"store","response":"ok"}');

      expect(result.followUpQuestion).toBeNull();
    });
  });
});

// ============================================================================
// B. Classification Tests (with mocked LLM)
// ============================================================================

describe('processMessage classification', () => {
  it('classifies food storage intent', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'food',
        extracted: { foodName: 'pizza', mealType: 'lunch' },
        missingFields: [],
        response: 'Logged your lunch, sir.',
        confidence: 0.95,
      })
    );

    const result = await processMessage({
      message: 'I had pizza for lunch',
      conversationHistory: [],
    });

    expect(result.intent).toBe('store');
    expect(result.dataType).toBe('food');
    expect(result.extracted?.foodName).toBe('pizza');
  });

  it('classifies food query intent', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'query',
        dataType: 'food',
        extracted: { timeframe: 'today' },
        missingFields: [],
        response: 'Let me check what you ate today, sir.',
        confidence: 0.9,
      })
    );

    const result = await processMessage({
      message: 'What did I eat today?',
      conversationHistory: [],
    });

    expect(result.intent).toBe('query');
    expect(result.dataType).toBe('food');
  });

  it('classifies task storage intent', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'task',
        extracted: { title: 'call mom' },
        missingFields: [],
        response: 'I shall remind you to call your mother, sir.',
        confidence: 0.92,
      })
    );

    const result = await processMessage({
      message: 'Remind me to call mom',
      conversationHistory: [],
    });

    expect(result.intent).toBe('store');
    expect(result.dataType).toBe('task');
    expect(result.extracted?.title).toBe('call mom');
  });

  it('classifies general conversation', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'conversation',
        dataType: null,
        extracted: null,
        missingFields: [],
        response: 'Good day to you as well, sir.',
        confidence: 0.95,
      })
    );

    const result = await processMessage({
      message: 'Hello',
      conversationHistory: [],
    });

    expect(result.intent).toBe('conversation');
    expect(result.dataType).toBeNull();
    expect(result.extracted).toBeNull();
  });
});

// ============================================================================
// C. Extraction Accuracy Tests
// ============================================================================

describe('extraction accuracy', () => {
  describe('food extraction', () => {
    it('extracts foodName, mealType, quantity', async () => {
      mockChat.mockResolvedValueOnce(
        JSON.stringify({
          intent: 'store',
          dataType: 'food',
          extracted: {
            foodName: 'chicken salad',
            mealType: 'lunch',
            quantity: '1 bowl',
            calories: 350,
          },
          missingFields: [],
          response: 'Logged your chicken salad for lunch, sir.',
          confidence: 0.94,
        })
      );

      const result = await processMessage({
        message: 'I had a bowl of chicken salad for lunch, about 350 calories',
        conversationHistory: [],
      });

      expect(result.extracted).toEqual({
        foodName: 'chicken salad',
        mealType: 'lunch',
        quantity: '1 bowl',
        calories: 350,
      });
    });
  });

  describe('task extraction', () => {
    it('extracts title, dueDate, priority', async () => {
      mockChat.mockResolvedValueOnce(
        JSON.stringify({
          intent: 'store',
          dataType: 'task',
          extracted: {
            title: 'submit report',
            dueDate: '2024-03-15',
            priority: 'high',
          },
          missingFields: [],
          response: 'High priority task noted for March 15th, sir.',
          confidence: 0.93,
        })
      );

      const result = await processMessage({
        message: 'I need to submit the report by March 15th, high priority',
        conversationHistory: [],
      });

      expect(result.extracted).toEqual({
        title: 'submit report',
        dueDate: '2024-03-15',
        priority: 'high',
      });
    });
  });

  describe('entity extraction', () => {
    it('extracts name, entityType, relationship', async () => {
      mockChat.mockResolvedValueOnce(
        JSON.stringify({
          intent: 'store',
          dataType: 'entity',
          extracted: {
            name: 'Sarah',
            entityType: 'person',
            relationship: 'sister',
            birthday: '1990-05-20',
          },
          missingFields: [],
          response: "I've noted Sarah as your sister, sir.",
          confidence: 0.91,
        })
      );

      const result = await processMessage({
        message: "Sarah is my sister, her birthday is May 20th 1990",
        conversationHistory: [],
      });

      expect(result.extracted).toEqual({
        name: 'Sarah',
        entityType: 'person',
        relationship: 'sister',
        birthday: '1990-05-20',
      });
    });
  });

  describe('transaction extraction', () => {
    it('extracts amount, category, vendor', async () => {
      mockChat.mockResolvedValueOnce(
        JSON.stringify({
          intent: 'store',
          dataType: 'transaction',
          extracted: {
            amount: 45.99,
            transactionType: 'expense',
            category: 'groceries',
            vendor: 'Whole Foods',
          },
          missingFields: [],
          response: 'Expense of $45.99 at Whole Foods recorded, sir.',
          confidence: 0.95,
        })
      );

      const result = await processMessage({
        message: 'I spent $45.99 at Whole Foods on groceries',
        conversationHistory: [],
      });

      expect(result.extracted).toEqual({
        amount: 45.99,
        transactionType: 'expense',
        category: 'groceries',
        vendor: 'Whole Foods',
      });
    });
  });
});

// ============================================================================
// D. Missing Field Detection
// ============================================================================

describe('missing field detection', () => {
  it('detects missing mealType for food', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'food',
        extracted: { foodName: 'something' },
        missingFields: ['mealType'],
        response: 'What meal was this for, sir?',
        followUpQuestion: 'Was this for breakfast, lunch, dinner, or a snack?',
        confidence: 0.7,
      })
    );

    const result = await processMessage({
      message: 'I had something',
      conversationHistory: [],
    });

    expect(result.missingFields).toContain('mealType');
    expect(result.followUpQuestion).toBeTruthy();
  });

  it('detects missing title for task', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'task',
        extracted: {},
        missingFields: ['title'],
        response: 'What would you like me to remind you about, sir?',
        followUpQuestion: 'Please specify what you need to be reminded of.',
        confidence: 0.6,
      })
    );

    const result = await processMessage({
      message: 'Remind me',
      conversationHistory: [],
    });

    expect(result.missingFields).toContain('title');
  });

  it('detects multiple missing fields', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'transaction',
        extracted: { transactionType: 'expense' },
        missingFields: ['amount', 'category'],
        response: 'How much did you spend, and on what category, sir?',
        confidence: 0.5,
      })
    );

    const result = await processMessage({
      message: 'I bought something',
      conversationHistory: [],
    });

    expect(result.missingFields).toEqual(['amount', 'category']);
  });
});

// ============================================================================
// E. Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('handles empty message', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'conversation',
        dataType: null,
        extracted: null,
        missingFields: [],
        response: 'I await your command, sir.',
        confidence: 0.3,
      })
    );

    const result = await processMessage({
      message: '',
      conversationHistory: [],
    });

    expect(result.intent).toBe('conversation');
    expect(mockChat).toHaveBeenCalled();
  });

  it('handles very long message', async () => {
    const longMessage = 'This is a very long message. '.repeat(100);

    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'conversation',
        dataType: null,
        extracted: null,
        missingFields: [],
        response: 'That was quite verbose, sir.',
        confidence: 0.5,
      })
    );

    const result = await processMessage({
      message: longMessage,
      conversationHistory: [],
    });

    expect(result).toBeDefined();
    expect(mockChat).toHaveBeenCalled();
  });

  it('handles message with special characters', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'food',
        extracted: { foodName: 'crème brûlée', mealType: 'dessert' },
        missingFields: [],
        response: 'Logged your crème brûlée, sir.',
        confidence: 0.9,
      })
    );

    const result = await processMessage({
      message: 'I had crème brûlée for dessert! 🍮 <script>alert("xss")</script>',
      conversationHistory: [],
    });

    expect(result.extracted?.foodName).toBe('crème brûlée');
  });

  it('handles unicode and emoji in messages', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'entity',
        extracted: { name: '田中', entityType: 'person' },
        missingFields: ['relationship'],
        response: 'Who is 田中 to you, sir?',
        confidence: 0.8,
      })
    );

    const result = await processMessage({
      message: '田中さん is a friend 👋',
      conversationHistory: [],
    });

    expect(result.extracted?.name).toBe('田中');
  });
});

// ============================================================================
// F. classifyIntent Quick Classification
// ============================================================================

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

// ============================================================================
// G. processMessageStream
// ============================================================================

describe('processMessageStream', () => {
  it('streams response and provides final brainResponse', async () => {
    const fullResponse = JSON.stringify({
      intent: 'store',
      dataType: 'food',
      extracted: { foodName: 'apple', mealType: 'snack' },
      missingFields: [],
      response: 'Noted your snack, sir.',
      confidence: 0.9,
    });

    // Create an async generator mock
    async function* mockGenerator() {
      yield { content: fullResponse.slice(0, 50), done: false };
      yield { content: fullResponse.slice(50), done: true };
    }

    mockChatStream.mockReturnValue(mockGenerator());

    const chunks: Array<{ type: string; content: string; brainResponse?: BrainResponse }> = [];

    for await (const chunk of processMessageStream({
      message: 'I ate an apple',
      conversationHistory: [],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(3); // 2 partials + 1 complete
    expect(chunks[0]!.type).toBe('partial');
    expect(chunks[2]!.type).toBe('complete');
    expect(chunks[2]!.brainResponse?.intent).toBe('store');
  });
});

// ============================================================================
// H. Conversation History Context
// ============================================================================

describe('conversation history', () => {
  it('includes conversation history in LLM call', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'food',
        extracted: { foodName: 'coffee', mealType: 'breakfast' },
        missingFields: [],
        response: 'Logged your coffee, sir.',
        confidence: 0.9,
      })
    );

    await processMessage({
      message: 'Also had coffee',
      conversationHistory: [
        { role: 'user', content: 'I had eggs for breakfast', timestamp: '2024-01-01T08:00:00Z' },
        { role: 'assistant', content: 'Logged your eggs, sir.', timestamp: '2024-01-01T08:00:01Z' },
      ],
    });

    // Verify history was passed to chat
    const callArgs = mockChat.mock.calls[0]![0];
    expect(callArgs.length).toBeGreaterThan(2); // system + history + user
    expect(callArgs.some((m: { content: string }) => m.content.includes('eggs'))).toBe(true);
  });

  it('includes pending context in multi-turn flow', async () => {
    mockChat.mockResolvedValueOnce(
      JSON.stringify({
        intent: 'store',
        dataType: 'food',
        extracted: { foodName: 'pasta', mealType: 'dinner' },
        missingFields: [],
        response: 'Logged your pasta dinner, sir.',
        confidence: 0.95,
      })
    );

    await processMessage({
      message: 'dinner',
      conversationHistory: [],
      pendingContext: {
        dataType: 'food',
        partialData: { foodName: 'pasta' },
        missingFields: ['mealType'],
        startedAt: '2024-01-01T18:00:00Z',
      },
    });

    // Verify pending context was included
    const callArgs = mockChat.mock.calls[0]![0];
    const contextMessage = callArgs.find((m: { content: string }) =>
      m.content.includes('CONTEXT') && m.content.includes('pasta')
    );
    expect(contextMessage).toBeDefined();
  });
});
