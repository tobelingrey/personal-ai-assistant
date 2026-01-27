/**
 * Entity search operations
 */

import { query } from '../database.js';
import type { Entity } from '../../types/domains.js';
import type { EntityRow } from './types.js';
import { rowToEntity } from './mappers.js';

/**
 * Search entities by partial name match
 */
export async function searchEntities(searchTerm: string): Promise<Entity[]> {
  const rows = query<EntityRow>(
    `SELECT * FROM entities
     WHERE LOWER(name) LIKE LOWER(?)
     OR aliases LIKE ?
     ORDER BY name ASC`,
    [`%${searchTerm}%`, `%${searchTerm}%`]
  );
  return rows.map(rowToEntity);
}
