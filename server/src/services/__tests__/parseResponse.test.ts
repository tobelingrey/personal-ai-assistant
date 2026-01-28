/**
 * parseResponse Unit Tests
 *
 * Tests for JSON parsing and fallback behavior in brain.ts
 */

import { describe, it, expect } from 'vitest';
import { parseResponse } from '../brain.js';

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
