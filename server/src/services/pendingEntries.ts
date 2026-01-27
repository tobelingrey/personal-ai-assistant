/**
 * Pending Entries Service
 *
 * Stores unclassified messages for self-evolution pattern detection.
 * Messages with low confidence that fall back to conversation
 * may contain patterns that could become new domains.
 */

import { query, run } from './database.js';
import type { BrainResponse } from '../types/schema.js';

export interface PendingEntry {
  id: number;
  message: string;
  brainResponse: BrainResponse;
  confidence: number;
  createdAt: string;
}

interface PendingEntryRow {
  id: number;
  message: string;
  brain_response: string;
  confidence: number;
  created_at: string;
}

/**
 * Create a pending entry for an unclassified message
 */
export function createPendingEntry(
  message: string,
  brainResponse: BrainResponse
): PendingEntry {
  const brainResponseJson = JSON.stringify(brainResponse);

  const result = run(
    `INSERT INTO pending_entries (message, brain_response, confidence, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [message, brainResponseJson, brainResponse.confidence]
  );

  const entry: PendingEntry = {
    id: result.lastID,
    message,
    brainResponse,
    confidence: brainResponse.confidence,
    createdAt: new Date().toISOString(),
  };

  console.log(`[PendingEntries] Created entry ${entry.id} (confidence: ${brainResponse.confidence})`);

  return entry;
}

/**
 * Get pending entries, optionally limited
 * Returns newest first (ordered by id DESC for reliable ordering)
 */
export function getPendingEntries(limit?: number): PendingEntry[] {
  const sql = limit
    ? 'SELECT * FROM pending_entries ORDER BY id DESC LIMIT ?'
    : 'SELECT * FROM pending_entries ORDER BY id DESC';
  const params = limit ? [limit] : [];

  const rows = query<PendingEntryRow>(sql, params);

  return rows.map(rowToEntry);
}

/**
 * Get a single pending entry by ID
 */
export function getPendingEntryById(id: number): PendingEntry | null {
  const rows = query<PendingEntryRow>(
    'SELECT * FROM pending_entries WHERE id = ?',
    [id]
  );

  return rows.length > 0 ? rowToEntry(rows[0]!) : null;
}

/**
 * Get pending entries by IDs
 */
export function getPendingEntriesByIds(ids: number[]): PendingEntry[] {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const rows = query<PendingEntryRow>(
    `SELECT * FROM pending_entries WHERE id IN (${placeholders}) ORDER BY id DESC`,
    ids
  );

  return rows.map(rowToEntry);
}

/**
 * Get pending entries with confidence below a threshold
 */
export function getPendingEntriesByConfidence(
  maxConfidence: number,
  limit?: number
): PendingEntry[] {
  const sql = limit
    ? 'SELECT * FROM pending_entries WHERE confidence <= ? ORDER BY confidence ASC LIMIT ?'
    : 'SELECT * FROM pending_entries WHERE confidence <= ? ORDER BY confidence ASC';
  const params = limit ? [maxConfidence, limit] : [maxConfidence];

  const rows = query<PendingEntryRow>(sql, params);

  return rows.map(rowToEntry);
}

/**
 * Delete a pending entry by ID
 */
export function deletePendingEntry(id: number): boolean {
  const result = run('DELETE FROM pending_entries WHERE id = ?', [id]);
  const deleted = result.changes > 0;

  if (deleted) {
    console.log(`[PendingEntries] Deleted entry ${id}`);
  }

  return deleted;
}

/**
 * Delete multiple pending entries by IDs
 */
export function deletePendingEntries(ids: number[]): number {
  if (ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(',');
  const result = run(
    `DELETE FROM pending_entries WHERE id IN (${placeholders})`,
    ids
  );

  console.log(`[PendingEntries] Deleted ${result.changes} entries`);

  return result.changes;
}

/**
 * Get count of pending entries
 */
export function getPendingEntryCount(): number {
  const result = query<{ count: number }>(
    'SELECT COUNT(*) as count FROM pending_entries',
    []
  );
  return result[0]?.count ?? 0;
}

/**
 * Convert database row to PendingEntry
 */
function rowToEntry(row: PendingEntryRow): PendingEntry {
  return {
    id: row.id,
    message: row.message,
    brainResponse: JSON.parse(row.brain_response) as BrainResponse,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}
