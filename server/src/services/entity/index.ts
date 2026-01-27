/**
 * Entity Domain Service
 *
 * Handles CRUD operations for entities (people, pets, organizations, places).
 * Supports aliases for flexible name matching.
 */

// Re-export types
export type { EntityRow } from './types.js';

// Re-export mappers
export { rowToEntity } from './mappers.js';

// Re-export CRUD functions
export {
  createEntity,
  getEntityById,
  getAllEntities,
  getEntitiesByType,
  updateEntity,
  deleteEntity,
} from './crud.js';

// Re-export alias functions
export {
  getEntityByName,
  findEntityByNameOrAlias,
  addEntityAlias,
} from './aliases.js';

// Re-export search functions
export { searchEntities } from './search.js';

// Re-export person functions
export {
  getUpcomingBirthdays,
  getPeople,
} from './person.js';
