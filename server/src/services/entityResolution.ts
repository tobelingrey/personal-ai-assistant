/**
 * Entity Resolution Service
 *
 * Resolves entity mentions to existing entities using:
 * 1. Exact name matching
 * 2. Alias matching
 * 3. Vector similarity search for fuzzy matching
 *
 * MAY import: entity.ts, vectors.ts
 * MUST NOT import: brain.ts, routes, other services
 */

import {
  findEntityByNameOrAlias,
  getEntityById,
} from './entity/index.js';
import { searchEntities } from './vectors.js';
import type { Entity, EntityType } from '../types/domains.js';

// Confidence thresholds
export const THRESHOLD_AUTO_LINK = 0.8; // Auto-link without confirmation
export const THRESHOLD_ASK = 0.5; // Ask user for disambiguation
// Below THRESHOLD_ASK: suggest creating new entity

export interface ResolutionResult {
  entity: Entity | null;
  confidence: number;
  action: 'linked' | 'ask' | 'new';
  candidates?: Entity[];
}

export interface ResolutionOptions {
  mention: string;
  entityType?: EntityType;
}

/**
 * Resolve an entity mention to an existing entity
 *
 * Resolution algorithm:
 * 1. Exact name/alias match → confidence 1.0, action: "linked"
 * 2. Vector similarity search → apply thresholds
 * 3. Return appropriate action with candidates if ambiguous
 */
export async function resolveEntity(
  options: ResolutionOptions
): Promise<ResolutionResult> {
  const { mention, entityType } = options;

  if (!mention || mention.trim().length === 0) {
    return {
      entity: null,
      confidence: 0,
      action: 'new',
    };
  }

  const normalizedMention = mention.trim();

  // Step 1: Try exact name or alias match
  const exactMatch = await findEntityByNameOrAlias(normalizedMention);
  if (exactMatch) {
    // If entityType is specified, ensure it matches
    if (entityType && exactMatch.entityType !== entityType) {
      // Type mismatch - might be different entity with same name
      // Continue to vector search
    } else {
      return {
        entity: exactMatch,
        confidence: 1.0,
        action: 'linked',
      };
    }
  }

  // Step 2: Vector similarity search
  const vectorMatches = await searchEntities(normalizedMention, 5);

  if (vectorMatches.length === 0) {
    return {
      entity: null,
      confidence: 0,
      action: 'new',
    };
  }

  // Filter by entity type if specified
  let filteredMatches = vectorMatches;
  if (entityType) {
    const matchedEntities = await Promise.all(
      vectorMatches.map(async (match) => {
        const entity = await getEntityById(match.entityId);
        return { match, entity };
      })
    );

    filteredMatches = matchedEntities
      .filter((m) => m.entity && m.entity.entityType === entityType)
      .map((m) => m.match);

    if (filteredMatches.length === 0) {
      return {
        entity: null,
        confidence: 0,
        action: 'new',
      };
    }
  }

  const topMatch = filteredMatches[0]!;
  const topEntity = await getEntityById(topMatch.entityId);

  if (!topEntity) {
    return {
      entity: null,
      confidence: 0,
      action: 'new',
    };
  }

  // Step 3: Apply confidence thresholds
  if (topMatch.similarity >= THRESHOLD_AUTO_LINK) {
    return {
      entity: topEntity,
      confidence: topMatch.similarity,
      action: 'linked',
    };
  }

  if (topMatch.similarity >= THRESHOLD_ASK) {
    // Gather candidates for disambiguation
    const candidateEntities = await Promise.all(
      filteredMatches
        .filter((m) => m.similarity >= THRESHOLD_ASK)
        .slice(0, 3)
        .map((m) => getEntityById(m.entityId))
    );

    const candidates = candidateEntities.filter((e): e is Entity => e !== null);

    return {
      entity: null,
      confidence: topMatch.similarity,
      action: 'ask',
      candidates,
    };
  }

  // Below threshold - suggest new entity
  return {
    entity: null,
    confidence: topMatch.similarity,
    action: 'new',
  };
}

/**
 * Resolve multiple entity mentions
 */
export async function resolveEntities(
  mentions: ResolutionOptions[]
): Promise<ResolutionResult[]> {
  return Promise.all(mentions.map(resolveEntity));
}

/**
 * Check if a mention likely refers to an existing entity
 * Quick check without full resolution
 */
export async function hasLikelyMatch(mention: string): Promise<boolean> {
  const result = await resolveEntity({ mention });
  return result.action === 'linked' || result.action === 'ask';
}
