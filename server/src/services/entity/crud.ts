/**
 * Entity CRUD operations
 */

import { query, run, getNowISO } from '../database.js';
import { storeEntityEmbedding, deleteEntityEmbedding } from '../vectors.js';
import type { Entity, EntityCreate, FilterOptions, EntityType } from '../../types/domains.js';
import type { EntityRow } from './types.js';
import { rowToEntity } from './mappers.js';

/**
 * Create a new entity
 */
export async function createEntity(data: EntityCreate): Promise<Entity> {
  const aliasesJson = data.aliases ? JSON.stringify(data.aliases) : null;

  const result = run(
    `INSERT INTO entities (name, entity_type, relationship, birthday, notes, aliases)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.entityType,
      data.relationship ?? null,
      data.birthday ?? null,
      data.notes ?? null,
      aliasesJson,
    ]
  );

  const created = await getEntityById(result.lastID);
  if (!created) throw new Error('Failed to create entity');

  // Generate embedding for entity resolution (fire and forget, don't block)
  storeEntityEmbedding(
    created.id,
    created.name,
    created.relationship,
    created.aliases
  ).catch((err) => {
    console.error(`[Entity] Failed to store embedding for entity ${created.id}:`, err);
  });

  return created;
}

/**
 * Get an entity by ID
 */
export async function getEntityById(id: number): Promise<Entity | null> {
  const rows = query<EntityRow>('SELECT * FROM entities WHERE id = ?', [id]);
  const row = rows[0];
  return row ? rowToEntity(row) : null;
}

/**
 * Get all entities with optional filters
 */
export async function getAllEntities(filters: FilterOptions = {}): Promise<Entity[]> {
  let sql = 'SELECT * FROM entities WHERE 1=1';
  const params: unknown[] = [];

  sql += ' ORDER BY name ASC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  const rows = query<EntityRow>(sql, params);
  return rows.map(rowToEntity);
}

/**
 * Get entities by type
 */
export async function getEntitiesByType(type: EntityType): Promise<Entity[]> {
  const rows = query<EntityRow>(
    'SELECT * FROM entities WHERE entity_type = ? ORDER BY name ASC',
    [type]
  );
  return rows.map(rowToEntity);
}

/**
 * Update an entity
 */
export async function updateEntity(
  id: number,
  data: Partial<EntityCreate>
): Promise<Entity | null> {
  const existing = await getEntityById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.entityType !== undefined) {
    updates.push('entity_type = ?');
    params.push(data.entityType);
  }
  if (data.relationship !== undefined) {
    updates.push('relationship = ?');
    params.push(data.relationship);
  }
  if (data.birthday !== undefined) {
    updates.push('birthday = ?');
    params.push(data.birthday);
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    params.push(data.notes);
  }
  if (data.aliases !== undefined) {
    updates.push('aliases = ?');
    params.push(JSON.stringify(data.aliases));
  }

  if (updates.length === 0) return existing;

  // Track if name or aliases changed (affects embedding)
  const embeddingFieldsChanged =
    data.name !== undefined || data.aliases !== undefined || data.relationship !== undefined;

  updates.push('updated_at = ?');
  params.push(getNowISO());
  params.push(id);

  run(`UPDATE entities SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = await getEntityById(id);

  // Regenerate embedding if name, relationship, or aliases changed
  if (embeddingFieldsChanged && updated) {
    storeEntityEmbedding(
      updated.id,
      updated.name,
      updated.relationship,
      updated.aliases
    ).catch((err) => {
      console.error(`[Entity] Failed to update embedding for entity ${updated.id}:`, err);
    });
  }

  return updated;
}

/**
 * Delete an entity
 */
export async function deleteEntity(id: number): Promise<boolean> {
  const result = run('DELETE FROM entities WHERE id = ?', [id]);

  if (result.changes > 0) {
    // Remove embedding (cascades via FK, but also clean memory cache)
    deleteEntityEmbedding(id);
  }

  return result.changes > 0;
}
