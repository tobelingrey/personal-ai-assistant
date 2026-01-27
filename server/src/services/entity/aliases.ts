/**
 * Entity alias management and resolution
 */

import { query } from '../database.js';
import type { Entity } from '../../types/domains.js';
import type { EntityRow } from './types.js';
import { rowToEntity } from './mappers.js';
import { getEntityById, updateEntity } from './crud.js';

/**
 * Find entity by name (exact match)
 */
export async function getEntityByName(name: string): Promise<Entity | null> {
  const rows = query<EntityRow>(
    'SELECT * FROM entities WHERE LOWER(name) = LOWER(?)',
    [name]
  );
  const row = rows[0];
  return row ? rowToEntity(row) : null;
}

/**
 * Find entity by name or alias (for entity resolution)
 */
export async function findEntityByNameOrAlias(mention: string): Promise<Entity | null> {
  const lowerMention = mention.toLowerCase();

  // First try exact name match
  const exactMatch = await getEntityByName(mention);
  if (exactMatch) return exactMatch;

  // Then search aliases
  const allEntities = query<EntityRow>('SELECT * FROM entities WHERE aliases IS NOT NULL', []);

  for (const row of allEntities) {
    if (row.aliases) {
      try {
        const aliases = JSON.parse(row.aliases) as string[];
        if (aliases.some((alias) => alias.toLowerCase() === lowerMention)) {
          return rowToEntity(row);
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Add an alias to an entity
 */
export async function addEntityAlias(id: number, alias: string): Promise<Entity | null> {
  const existing = await getEntityById(id);
  if (!existing) return null;

  const currentAliases = existing.aliases ?? [];
  if (!currentAliases.includes(alias)) {
    currentAliases.push(alias);
    return updateEntity(id, { aliases: currentAliases });
  }

  return existing;
}
