/**
 * Vector Storage Service
 *
 * Manages entity embeddings for semantic search/entity resolution.
 * Uses in-memory storage with SQLite persistence for low entity counts.
 * Abstracts storage for future LanceDB migration if needed.
 */

import { query, run } from './database.js';
import { embed } from './ollama.js';

interface EmbeddingRow {
  entity_id: number;
  embedding: Uint8Array;
  text_embedded: string;
  updated_at: string;
}

interface EntityMatch {
  entityId: number;
  similarity: number;
  textEmbedded: string;
}

// In-memory cache of entity embeddings
const embeddingCache = new Map<number, { embedding: number[]; textEmbedded: string }>();

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
 * Initialize vector storage
 * Loads existing embeddings from SQLite into memory cache
 */
export async function initialize(): Promise<void> {
  embeddingCache.clear();

  try {
    const rows = query<EmbeddingRow>('SELECT * FROM entity_embeddings', []);

    for (const row of rows) {
      const embedding = blobToEmbedding(row.embedding);
      embeddingCache.set(row.entity_id, {
        embedding,
        textEmbedded: row.text_embedded,
      });
    }

    console.log(`[Vectors] Loaded ${embeddingCache.size} entity embeddings into memory`);
  } catch (error) {
    // Table might not exist yet on first run
    console.log('[Vectors] No existing embeddings found (table may not exist yet)');
  }
}

/**
 * Generate and store embedding for an entity
 * Creates searchable text from entity name, relationship, and aliases
 */
export async function storeEntityEmbedding(
  entityId: number,
  name: string,
  relationship?: string,
  aliases?: string[]
): Promise<void> {
  // Build searchable text combining name, relationship, and aliases
  const textParts = [name];
  if (relationship) {
    textParts.push(relationship);
  }
  if (aliases && aliases.length > 0) {
    textParts.push(...aliases);
  }
  const textEmbedded = textParts.join(' ');

  try {
    // Generate embedding using Ollama
    const embedding = await embed(textEmbedded);
    const blob = embeddingToBlob(embedding);

    // Upsert into SQLite
    run(
      `INSERT INTO entity_embeddings (entity_id, embedding, text_embedded, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(entity_id) DO UPDATE SET
         embedding = excluded.embedding,
         text_embedded = excluded.text_embedded,
         updated_at = datetime('now')`,
      [entityId, blob, textEmbedded]
    );

    // Update in-memory cache
    embeddingCache.set(entityId, { embedding, textEmbedded });

    console.log(`[Vectors] Stored embedding for entity ${entityId}: "${textEmbedded}"`);
  } catch (error) {
    console.error(`[Vectors] Failed to generate embedding for entity ${entityId}:`, error);
    throw error;
  }
}

/**
 * Search entities by semantic similarity
 * Returns matches sorted by similarity (highest first)
 */
export async function searchEntities(
  queryText: string,
  limit: number = 5
): Promise<EntityMatch[]> {
  if (embeddingCache.size === 0) {
    return [];
  }

  try {
    // Generate embedding for query
    const queryEmbedding = await embed(queryText);

    // Calculate similarity against all cached embeddings
    const matches: EntityMatch[] = [];

    for (const [entityId, cached] of embeddingCache) {
      const similarity = cosineSimilarity(queryEmbedding, cached.embedding);
      matches.push({
        entityId,
        similarity,
        textEmbedded: cached.textEmbedded,
      });
    }

    // Sort by similarity (descending) and return top N
    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, limit);
  } catch (error) {
    console.error('[Vectors] Search failed:', error);
    return [];
  }
}

/**
 * Delete embedding for an entity
 */
export function deleteEntityEmbedding(entityId: number): void {
  // Remove from SQLite
  run('DELETE FROM entity_embeddings WHERE entity_id = ?', [entityId]);

  // Remove from memory cache
  embeddingCache.delete(entityId);

  console.log(`[Vectors] Deleted embedding for entity ${entityId}`);
}

/**
 * Check if an entity has an embedding stored
 */
export function hasEmbedding(entityId: number): boolean {
  return embeddingCache.has(entityId);
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
    run('DELETE FROM entity_embeddings', []);
  } catch {
    // Table might not exist
  }
}
