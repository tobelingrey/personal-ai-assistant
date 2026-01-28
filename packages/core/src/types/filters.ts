/**
 * Domain-specific filter types for Jarvis
 *
 * These extend the base FilterOptions to provide type-safe
 * filtering for each domain's query operations.
 */

import type {
  MealType,
  EnrichmentStatus,
  TaskStatus,
  TaskPriority,
  EntityType,
  TransactionType,
} from './domains.js';

// ============ Base Filters ============

export interface BaseFilters {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ============ Transaction Filters ============

export interface TransactionFilters extends BaseFilters {
  category?: string;
  type?: TransactionType;
}

// ============ Task Filters ============

export interface TaskFilters extends BaseFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  context?: string;
}

// ============ Food Filters ============

export interface FoodFilters extends BaseFilters {
  mealType?: MealType;
  enrichmentStatus?: EnrichmentStatus;
}

// ============ Entity Filters ============

export interface EntityFilters extends BaseFilters {
  entityType?: EntityType;
  searchTerm?: string;
}
