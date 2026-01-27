/**
 * Person-specific entity operations
 */

import { query } from '../database.js';
import type { Entity } from '../../types/domains.js';
import type { EntityRow } from './types.js';
import { rowToEntity } from './mappers.js';
import { getEntitiesByType } from './crud.js';

/**
 * Get entities with upcoming birthdays
 */
export async function getUpcomingBirthdays(daysAhead: number = 30): Promise<Entity[]> {
  // SQLite date math for finding birthdays in the next N days
  // This is a simplified version - in production you'd want more sophisticated date handling
  const rows = query<EntityRow>(
    `SELECT * FROM entities
     WHERE birthday IS NOT NULL
     AND entity_type = 'person'
     ORDER BY
       CASE
         WHEN SUBSTR(birthday, 6) >= SUBSTR(DATE('now'), 6)
         THEN SUBSTR(birthday, 6)
         ELSE '13' || SUBSTR(birthday, 6)
       END
     LIMIT 10`,
    []
  );

  return rows.map(rowToEntity);
}

/**
 * Get people entities (most common entity type)
 */
export async function getPeople(): Promise<Entity[]> {
  return getEntitiesByType('person');
}
