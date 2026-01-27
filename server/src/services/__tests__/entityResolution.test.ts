/**
 * Entity Resolution Tests
 *
 * Tests for the entity resolution service that matches mentions
 * to existing entities using exact matching and vector similarity.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

// Mock the dependencies
vi.mock('../entity/index.js', () => ({
  findEntityByNameOrAlias: vi.fn(),
  getEntityById: vi.fn(),
  getAllEntities: vi.fn(),
}));

vi.mock('../vectors.js', () => ({
  searchEntities: vi.fn(),
}));

// Import mocked modules
import * as entity from '../entity/index.js';
import * as vectors from '../vectors.js';

// Import after mocking
import {
  resolveEntity,
  THRESHOLD_AUTO_LINK,
  THRESHOLD_ASK,
} from '../entityResolution.js';
import type { Entity } from '../../types/domains.js';

// Get typed mock references
const mockFindEntityByNameOrAlias = entity.findEntityByNameOrAlias as MockedFunction<
  typeof entity.findEntityByNameOrAlias
>;
const mockGetEntityById = entity.getEntityById as MockedFunction<typeof entity.getEntityById>;
const mockSearchEntities = vectors.searchEntities as MockedFunction<typeof vectors.searchEntities>;

// Test fixtures
const mockMargaret: Entity = {
  id: 1,
  name: 'Margaret',
  entityType: 'person',
  relationship: 'mother',
  aliases: ['Mom', 'Mum'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockSarah: Entity = {
  id: 2,
  name: 'Sarah',
  entityType: 'person',
  relationship: 'sister',
  aliases: ['Sis'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockJohn: Entity = {
  id: 3,
  name: 'John',
  entityType: 'person',
  relationship: 'friend',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// A. Exact Match Tests
// ============================================================================

describe('exact matching', () => {
  it('returns confidence 1.0 for exact name match', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(mockMargaret);

    const result = await resolveEntity({ mention: 'Margaret' });

    expect(result.action).toBe('linked');
    expect(result.confidence).toBe(1.0);
    expect(result.entity).toEqual(mockMargaret);
  });

  it('returns confidence 1.0 for alias match', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(mockMargaret);

    const result = await resolveEntity({ mention: 'Mom' });

    expect(result.action).toBe('linked');
    expect(result.confidence).toBe(1.0);
    expect(result.entity?.name).toBe('Margaret');
  });

  it('is case insensitive for exact matches', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(mockMargaret);

    const result = await resolveEntity({ mention: 'MARGARET' });

    expect(result.action).toBe('linked');
    expect(result.entity).toEqual(mockMargaret);
  });

  it('handles entity type filter on exact match', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(mockMargaret);

    const result = await resolveEntity({ mention: 'Margaret', entityType: 'person' });

    expect(result.action).toBe('linked');
    expect(result.entity).toEqual(mockMargaret);
  });
});

// ============================================================================
// B. Vector Similarity Tests
// ============================================================================

describe('vector similarity matching', () => {
  it('auto-links when similarity >= THRESHOLD_AUTO_LINK', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(null);
    mockSearchEntities.mockResolvedValueOnce([
      { entityId: 1, similarity: 0.85, textEmbedded: 'Margaret mother Mom Mum' },
    ]);
    mockGetEntityById.mockResolvedValueOnce(mockMargaret);

    const result = await resolveEntity({ mention: 'Mother' });

    expect(result.action).toBe('linked');
    expect(result.confidence).toBe(0.85);
    expect(result.entity?.name).toBe('Margaret');
  });

  it('returns "ask" action when similarity between THRESHOLD_ASK and THRESHOLD_AUTO_LINK', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(null);
    mockSearchEntities.mockResolvedValueOnce([
      { entityId: 1, similarity: 0.65, textEmbedded: 'Margaret mother Mom' },
      { entityId: 2, similarity: 0.55, textEmbedded: 'Sarah sister Sis' },
    ]);
    mockGetEntityById
      .mockResolvedValueOnce(mockMargaret)
      .mockResolvedValueOnce(mockMargaret)
      .mockResolvedValueOnce(mockSarah);

    const result = await resolveEntity({ mention: 'family member' });

    expect(result.action).toBe('ask');
    expect(result.confidence).toBe(0.65);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates?.[0]?.name).toBe('Margaret');
    expect(result.candidates?.[1]?.name).toBe('Sarah');
  });

  it('returns "new" action when similarity < THRESHOLD_ASK', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(null);
    mockSearchEntities.mockResolvedValueOnce([
      { entityId: 3, similarity: 0.3, textEmbedded: 'John friend' },
    ]);
    mockGetEntityById.mockResolvedValueOnce(mockJohn);

    const result = await resolveEntity({ mention: 'completely unknown person' });

    expect(result.action).toBe('new');
    expect(result.confidence).toBe(0.3);
    expect(result.entity).toBeNull();
  });

  it('filters by entity type in vector search', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(null);
    mockSearchEntities.mockResolvedValueOnce([
      { entityId: 1, similarity: 0.9, textEmbedded: 'Margaret mother' },
    ]);
    // getEntityById is called twice: once for filtering, once for topEntity
    mockGetEntityById
      .mockResolvedValueOnce(mockMargaret) // filtering call
      .mockResolvedValueOnce(mockMargaret); // topEntity call

    const result = await resolveEntity({ mention: 'Mother', entityType: 'person' });

    expect(result.action).toBe('linked');
    expect(result.entity?.entityType).toBe('person');
  });

  it('returns "new" when no vectors match entity type filter', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(null);
    mockSearchEntities.mockResolvedValueOnce([
      { entityId: 1, similarity: 0.9, textEmbedded: 'Margaret mother' },
    ]);
    mockGetEntityById.mockResolvedValueOnce(mockMargaret); // person type

    const result = await resolveEntity({ mention: 'Mother', entityType: 'organization' });

    expect(result.action).toBe('new');
  });
});

// ============================================================================
// C. Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('returns "new" for empty mention', async () => {
    const result = await resolveEntity({ mention: '' });

    expect(result.action).toBe('new');
    expect(result.confidence).toBe(0);
  });

  it('returns "new" for whitespace-only mention', async () => {
    const result = await resolveEntity({ mention: '   ' });

    expect(result.action).toBe('new');
    expect(result.confidence).toBe(0);
  });

  it('returns "new" when no vector matches found', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(null);
    mockSearchEntities.mockResolvedValueOnce([]);

    const result = await resolveEntity({ mention: 'Unknown Person' });

    expect(result.action).toBe('new');
    expect(result.confidence).toBe(0);
  });

  it('handles entity not found in database after vector match', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(null);
    mockSearchEntities.mockResolvedValueOnce([
      { entityId: 999, similarity: 0.9, textEmbedded: 'deleted entity' },
    ]);
    mockGetEntityById.mockResolvedValueOnce(null); // Entity was deleted

    const result = await resolveEntity({ mention: 'deleted' });

    expect(result.action).toBe('new');
  });

  it('trims whitespace from mention before matching', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(mockMargaret);

    const result = await resolveEntity({ mention: '  Margaret  ' });

    expect(result.action).toBe('linked');
    expect(mockFindEntityByNameOrAlias).toHaveBeenCalledWith('Margaret');
  });
});

// ============================================================================
// D. Threshold Constants
// ============================================================================

describe('threshold constants', () => {
  it('has THRESHOLD_AUTO_LINK at 0.8', () => {
    expect(THRESHOLD_AUTO_LINK).toBe(0.8);
  });

  it('has THRESHOLD_ASK at 0.5', () => {
    expect(THRESHOLD_ASK).toBe(0.5);
  });

  it('THRESHOLD_AUTO_LINK is greater than THRESHOLD_ASK', () => {
    expect(THRESHOLD_AUTO_LINK).toBeGreaterThan(THRESHOLD_ASK);
  });
});

// ============================================================================
// E. Disambiguation Candidates
// ============================================================================

describe('disambiguation candidates', () => {
  it('limits candidates to 3 entities', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(null);
    mockSearchEntities.mockResolvedValueOnce([
      { entityId: 1, similarity: 0.7, textEmbedded: 'entity1' },
      { entityId: 2, similarity: 0.65, textEmbedded: 'entity2' },
      { entityId: 3, similarity: 0.6, textEmbedded: 'entity3' },
      { entityId: 4, similarity: 0.55, textEmbedded: 'entity4' },
    ]);
    mockGetEntityById
      .mockResolvedValueOnce({ ...mockMargaret, id: 1 })
      .mockResolvedValueOnce({ ...mockMargaret, id: 1 })
      .mockResolvedValueOnce({ ...mockSarah, id: 2 })
      .mockResolvedValueOnce({ ...mockJohn, id: 3 });

    const result = await resolveEntity({ mention: 'ambiguous' });

    expect(result.action).toBe('ask');
    expect(result.candidates?.length).toBeLessThanOrEqual(3);
  });

  it('only includes candidates above THRESHOLD_ASK', async () => {
    mockFindEntityByNameOrAlias.mockResolvedValueOnce(null);
    mockSearchEntities.mockResolvedValueOnce([
      { entityId: 1, similarity: 0.7, textEmbedded: 'entity1' },
      { entityId: 2, similarity: 0.4, textEmbedded: 'entity2' }, // Below threshold
    ]);
    mockGetEntityById
      .mockResolvedValueOnce(mockMargaret)
      .mockResolvedValueOnce(mockMargaret); // For candidate retrieval

    const result = await resolveEntity({ mention: 'maybe' });

    expect(result.action).toBe('ask');
    expect(result.candidates?.length).toBe(1);
  });
});
