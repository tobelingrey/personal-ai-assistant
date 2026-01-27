/**
 * Pattern Detection Service
 *
 * Detects patterns in unclassified messages by embedding them
 * and finding clusters of similar messages. These clusters may
 * represent new domains that Jarvis should learn.
 */

import { query, run } from './database.js';
import { embed } from './ollama.js';
import { getPendingEntries, type PendingEntry } from './pendingEntries.js';

interface EmbeddingRow {
  entry_id: number;
  embedding: Uint8Array;
}

export interface PatternCluster {
  centroidEntryId: number;
  entryIds: number[];
  messages: string[];
  avgSimilarity: number;
}

// In-memory cache of pending entry embeddings
const embeddingCache = new Map<number, number[]>();

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Convert Float64Array to Uint8Array for SQLite BLOB storage
 */
function embeddingToBlob(embedding: number[]): Uint8Array {
  const float64 = new Float64Array(embedding);
  return new Uint8Array(float64.buffer);
}

/**
 * Convert Uint8Array from SQLite BLOB to number[]
 */
function blobToEmbedding(blob: Uint8Array): number[] {
  const float64 = new Float64Array(blob.buffer, blob.byteOffset, blob.byteLength / 8);
  return Array.from(float64);
}

/**
 * Initialize pattern detection
 * Loads existing embeddings from SQLite into memory cache
 */
export async function initializePatternDetection(): Promise<void> {
  embeddingCache.clear();

  try {
    const rows = query<EmbeddingRow>('SELECT * FROM pending_entry_embeddings', []);

    for (const row of rows) {
      const embedding = blobToEmbedding(row.embedding);
      embeddingCache.set(row.entry_id, embedding);
    }

    console.log(`[PatternDetection] Loaded ${embeddingCache.size} embeddings into memory`);
  } catch (error) {
    console.log('[PatternDetection] No existing embeddings found');
  }
}

/**
 * Generate and store embedding for a pending entry
 */
export async function embedPendingEntry(entryId: number, message: string): Promise<void> {
  try {
    const embedding = await embed(message);
    const blob = embeddingToBlob(embedding);

    // Upsert into SQLite
    run(
      `INSERT INTO pending_entry_embeddings (entry_id, embedding)
       VALUES (?, ?)
       ON CONFLICT(entry_id) DO UPDATE SET embedding = excluded.embedding`,
      [entryId, blob]
    );

    // Update cache
    embeddingCache.set(entryId, embedding);

    console.log(`[PatternDetection] Embedded entry ${entryId}`);
  } catch (error) {
    console.error(`[PatternDetection] Failed to embed entry ${entryId}:`, error);
    throw error;
  }
}

/**
 * Remove embedding for a pending entry
 */
export function deleteEmbedding(entryId: number): void {
  run('DELETE FROM pending_entry_embeddings WHERE entry_id = ?', [entryId]);
  embeddingCache.delete(entryId);
}

/**
 * Check if an entry has an embedding
 */
export function hasEmbedding(entryId: number): boolean {
  return embeddingCache.has(entryId);
}

/**
 * Embed all pending entries that don't have embeddings yet
 */
export async function embedAllPending(): Promise<number> {
  const entries = getPendingEntries();
  let embedded = 0;

  for (const entry of entries) {
    if (!embeddingCache.has(entry.id)) {
      try {
        await embedPendingEntry(entry.id, entry.message);
        embedded++;
      } catch {
        // Continue with other entries if one fails
      }
    }
  }

  return embedded;
}

/**
 * Find clusters of similar pending entries
 * Uses a simple greedy clustering algorithm
 *
 * @param minClusterSize Minimum entries to form a cluster
 * @param threshold Similarity threshold (0-1)
 * @returns Array of clusters, sorted by size descending
 */
export function detectPatterns(
  minClusterSize: number = 3,
  threshold: number = 0.75
): PatternCluster[] {
  const entries = getPendingEntries();
  const clusters: PatternCluster[] = [];
  const assigned = new Set<number>();

  // Get all entries with embeddings
  const entriesWithEmbeddings = entries.filter((e) => embeddingCache.has(e.id));

  if (entriesWithEmbeddings.length < minClusterSize) {
    return [];
  }

  // For each unassigned entry, try to form a cluster
  for (const entry of entriesWithEmbeddings) {
    if (assigned.has(entry.id)) continue;

    const embedding = embeddingCache.get(entry.id)!;
    const clusterEntries: PendingEntry[] = [entry];
    let totalSimilarity = 0;

    // Find similar unassigned entries
    for (const candidate of entriesWithEmbeddings) {
      if (candidate.id === entry.id || assigned.has(candidate.id)) continue;

      const candidateEmbedding = embeddingCache.get(candidate.id)!;
      const similarity = cosineSimilarity(embedding, candidateEmbedding);

      if (similarity >= threshold) {
        clusterEntries.push(candidate);
        totalSimilarity += similarity;
      }
    }

    // Only create cluster if it meets minimum size
    if (clusterEntries.length >= minClusterSize) {
      const cluster: PatternCluster = {
        centroidEntryId: entry.id,
        entryIds: clusterEntries.map((e) => e.id),
        messages: clusterEntries.map((e) => e.message),
        avgSimilarity: clusterEntries.length > 1
          ? totalSimilarity / (clusterEntries.length - 1)
          : 1.0,
      };

      clusters.push(cluster);

      // Mark entries as assigned
      for (const e of clusterEntries) {
        assigned.add(e.id);
      }
    }
  }

  // Sort by cluster size (largest first)
  clusters.sort((a, b) => b.entryIds.length - a.entryIds.length);

  return clusters;
}

/**
 * Get similarity matrix for a set of entry IDs
 * Useful for visualization
 */
export function getSimilarityMatrix(entryIds: number[]): number[][] {
  const matrix: number[][] = [];

  for (const idA of entryIds) {
    const row: number[] = [];
    const embeddingA = embeddingCache.get(idA);

    for (const idB of entryIds) {
      if (!embeddingA) {
        row.push(0);
        continue;
      }

      if (idA === idB) {
        row.push(1);
        continue;
      }

      const embeddingB = embeddingCache.get(idB);
      if (!embeddingB) {
        row.push(0);
        continue;
      }

      row.push(cosineSimilarity(embeddingA, embeddingB));
    }

    matrix.push(row);
  }

  return matrix;
}

/**
 * Get the current count of cached embeddings
 */
export function getEmbeddingCount(): number {
  return embeddingCache.size;
}

/**
 * Clear all embeddings (for testing)
 */
export function clearEmbeddings(): void {
  embeddingCache.clear();
  try {
    run('DELETE FROM pending_entry_embeddings', []);
  } catch {
    // Table might not exist
  }
}
