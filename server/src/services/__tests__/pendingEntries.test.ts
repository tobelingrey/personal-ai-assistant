/**
 * Pending Entries Service Tests
 *
 * Tests for storing and retrieving unclassified messages
 * used in the self-evolution pattern detection system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createPendingEntry,
  getPendingEntries,
  getPendingEntryById,
  getPendingEntriesByIds,
  getPendingEntriesByConfidence,
  deletePendingEntry,
  deletePendingEntries,
  getPendingEntryCount,
} from '../pendingEntries.js';
import { initDatabase, closeDatabase, run } from '../database.js';
import type { BrainResponse } from '../../types/schema.js';

// Helper to create a mock BrainResponse
function createMockBrainResponse(overrides: Partial<BrainResponse> = {}): BrainResponse {
  return {
    intent: 'conversation',
    dataType: null,
    extracted: null,
    missingFields: [],
    response: 'I understand, sir.',
    followUpQuestion: null,
    confidence: 0.5,
    ...overrides,
  };
}

describe('pendingEntries', () => {
  beforeEach(async () => {
    // Use in-memory database for tests
    process.env.JARVIS_DB_PATH = ':memory:';
    await initDatabase();
    // Clear pending entries table before each test
    run('DELETE FROM pending_entries', []);
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('createPendingEntry', () => {
    it('creates a pending entry with correct data', () => {
      const message = 'I did some gardening today';
      const brainResponse = createMockBrainResponse({ confidence: 0.4 });

      const entry = createPendingEntry(message, brainResponse);

      expect(entry.id).toBeGreaterThan(0);
      expect(entry.message).toBe(message);
      expect(entry.brainResponse).toEqual(brainResponse);
      expect(entry.confidence).toBe(0.4);
      expect(entry.createdAt).toBeDefined();
    });

    it('auto-increments IDs', () => {
      const entry1 = createPendingEntry('msg1', createMockBrainResponse());
      const entry2 = createPendingEntry('msg2', createMockBrainResponse());
      const entry3 = createPendingEntry('msg3', createMockBrainResponse());

      // IDs should be sequential (may not start at 1 due to test isolation)
      expect(entry2.id).toBe(entry1.id + 1);
      expect(entry3.id).toBe(entry2.id + 1);
    });

    it('stores complex brainResponse correctly', () => {
      const brainResponse = createMockBrainResponse({
        response: 'That sounds like a hobby, sir.',
        confidence: 0.65,
      });

      const entry = createPendingEntry('I collect stamps', brainResponse);
      const retrieved = getPendingEntryById(entry.id);

      expect(retrieved?.brainResponse.response).toBe('That sounds like a hobby, sir.');
      expect(retrieved?.brainResponse.intent).toBe('conversation');
    });
  });

  describe('getPendingEntries', () => {
    beforeEach(() => {
      // Create test entries with different times
      createPendingEntry('msg1', createMockBrainResponse({ confidence: 0.3 }));
      createPendingEntry('msg2', createMockBrainResponse({ confidence: 0.5 }));
      createPendingEntry('msg3', createMockBrainResponse({ confidence: 0.7 }));
    });

    it('returns all entries without limit', () => {
      const entries = getPendingEntries();
      expect(entries.length).toBe(3);
    });

    it('returns entries newest first', () => {
      const entries = getPendingEntries();
      // Last created should be first
      expect(entries[0]!.message).toBe('msg3');
      expect(entries[2]!.message).toBe('msg1');
    });

    it('respects limit parameter', () => {
      const entries = getPendingEntries(2);
      expect(entries.length).toBe(2);
    });
  });

  describe('getPendingEntryById', () => {
    it('returns entry when found', () => {
      const created = createPendingEntry('test msg', createMockBrainResponse());
      const found = getPendingEntryById(created.id);

      expect(found).not.toBeNull();
      expect(found?.message).toBe('test msg');
    });

    it('returns null when not found', () => {
      const found = getPendingEntryById(9999);
      expect(found).toBeNull();
    });
  });

  describe('getPendingEntriesByIds', () => {
    it('returns entries matching given IDs', () => {
      const e1 = createPendingEntry('msg1', createMockBrainResponse());
      createPendingEntry('msg2', createMockBrainResponse());
      const e3 = createPendingEntry('msg3', createMockBrainResponse());

      const entries = getPendingEntriesByIds([e1.id, e3.id]);

      expect(entries.length).toBe(2);
      expect(entries.map((e) => e.message)).toContain('msg1');
      expect(entries.map((e) => e.message)).toContain('msg3');
    });

    it('returns empty array for empty IDs', () => {
      const entries = getPendingEntriesByIds([]);
      expect(entries).toEqual([]);
    });

    it('ignores non-existent IDs', () => {
      const e1 = createPendingEntry('msg1', createMockBrainResponse());
      const entries = getPendingEntriesByIds([e1.id, 9999]);

      expect(entries.length).toBe(1);
    });
  });

  describe('getPendingEntriesByConfidence', () => {
    beforeEach(() => {
      createPendingEntry('low1', createMockBrainResponse({ confidence: 0.3 }));
      createPendingEntry('low2', createMockBrainResponse({ confidence: 0.4 }));
      createPendingEntry('med', createMockBrainResponse({ confidence: 0.6 }));
      createPendingEntry('high', createMockBrainResponse({ confidence: 0.8 }));
    });

    it('returns entries below confidence threshold', () => {
      const entries = getPendingEntriesByConfidence(0.5);

      expect(entries.length).toBe(2);
      expect(entries.every((e) => e.confidence <= 0.5)).toBe(true);
    });

    it('returns entries sorted by confidence ascending', () => {
      const entries = getPendingEntriesByConfidence(0.7);

      expect(entries[0]!.confidence).toBe(0.3);
      expect(entries[entries.length - 1]!.confidence).toBe(0.6);
    });

    it('respects limit parameter', () => {
      const entries = getPendingEntriesByConfidence(0.9, 2);
      expect(entries.length).toBe(2);
    });
  });

  describe('deletePendingEntry', () => {
    it('deletes existing entry and returns true', () => {
      const entry = createPendingEntry('to delete', createMockBrainResponse());

      const deleted = deletePendingEntry(entry.id);

      expect(deleted).toBe(true);
      expect(getPendingEntryById(entry.id)).toBeNull();
    });

    it('returns false for non-existent ID', () => {
      const deleted = deletePendingEntry(9999);
      expect(deleted).toBe(false);
    });
  });

  describe('deletePendingEntries', () => {
    it('deletes multiple entries', () => {
      const e1 = createPendingEntry('msg1', createMockBrainResponse());
      const e2 = createPendingEntry('msg2', createMockBrainResponse());
      const e3 = createPendingEntry('msg3', createMockBrainResponse());

      const count = deletePendingEntries([e1.id, e2.id]);

      expect(count).toBe(2);
      expect(getPendingEntryById(e1.id)).toBeNull();
      expect(getPendingEntryById(e2.id)).toBeNull();
      expect(getPendingEntryById(e3.id)).not.toBeNull();
    });

    it('returns 0 for empty array', () => {
      const count = deletePendingEntries([]);
      expect(count).toBe(0);
    });
  });

  describe('getPendingEntryCount', () => {
    it('returns 0 when empty', () => {
      expect(getPendingEntryCount()).toBe(0);
    });

    it('returns correct count', () => {
      createPendingEntry('msg1', createMockBrainResponse());
      createPendingEntry('msg2', createMockBrainResponse());

      expect(getPendingEntryCount()).toBe(2);
    });

    it('updates after deletions', () => {
      const entry = createPendingEntry('msg1', createMockBrainResponse());
      createPendingEntry('msg2', createMockBrainResponse());

      expect(getPendingEntryCount()).toBe(2);

      deletePendingEntry(entry.id);

      expect(getPendingEntryCount()).toBe(1);
    });
  });
});
