/**
 * Entity mappers - converts database rows to domain types
 */

import type { Entity, EntityType } from '../../types/domains.js';
import type { EntityRow } from './types.js';

/**
 * Convert database row to Entity type
 */
export function rowToEntity(row: EntityRow): Entity {
  let aliases: string[] | undefined;
  if (row.aliases) {
    try {
      aliases = JSON.parse(row.aliases) as string[];
    } catch {
      aliases = undefined;
    }
  }

  return {
    id: row.id,
    name: row.name,
    entityType: row.entity_type as EntityType,
    relationship: row.relationship ?? undefined,
    birthday: row.birthday ?? undefined,
    notes: row.notes ?? undefined,
    aliases,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
