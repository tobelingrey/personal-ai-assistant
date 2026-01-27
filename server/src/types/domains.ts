/**
 * Domain type interfaces for Jarvis
 *
 * These types define the shape of data stored in and retrieved from
 * the database for each domain.
 */

// ============ Food Domain ============

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type EnrichmentStatus = 'pending' | 'complete' | 'failed';

export interface FoodLogCreate {
  foodName: string;
  quantity?: string;
  mealType: MealType;
  mealDate?: string; // ISO date, defaults to today
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface FoodLog extends FoodLogCreate {
  id: number;
  mealDate: string;
  enrichmentStatus: EnrichmentStatus;
  createdAt: string;
  updatedAt: string;
}

// ============ Task Domain ============

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface TaskCreate {
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: TaskPriority;
  context?: string; // e.g., "work", "home", "errands"
}

export interface Task extends TaskCreate {
  id: number;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ============ Entity Domain ============

export type EntityType = 'person' | 'pet' | 'organization' | 'place';

export interface EntityCreate {
  name: string;
  entityType: EntityType;
  relationship?: string;
  birthday?: string;
  notes?: string;
  aliases?: string[]; // Stored as JSON in SQLite
}

export interface Entity extends EntityCreate {
  id: number;
  createdAt: string;
  updatedAt: string;
}

// ============ Transaction Domain ============

export type TransactionType = 'income' | 'expense';

export interface TransactionCreate {
  amount: number;
  transactionType: TransactionType;
  category?: string;
  vendor?: string;
  date?: string; // ISO date, defaults to today
  notes?: string;
}

export interface Transaction extends TransactionCreate {
  id: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Utility Types ============

export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface DomainService<T, CreateInput, UpdateInput> {
  create(data: CreateInput): Promise<T>;
  getById(id: number): Promise<T | null>;
  getAll(filters?: FilterOptions): Promise<T[]>;
  update(id: number, data: UpdateInput): Promise<T | null>;
  delete(id: number): Promise<boolean>;
}
