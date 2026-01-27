/**
 * Food Domain Service
 *
 * Handles CRUD operations for food logs.
 * Manages meal tracking and nutrition data.
 */

import { query, run, getTodayISO, getNowISO } from './database.js';
import type {
  FoodLog,
  FoodLogCreate,
  FilterOptions,
  MealType,
  EnrichmentStatus,
} from '../types/domains.js';

interface FoodLogRow {
  id: number;
  food_name: string;
  quantity: string | null;
  meal_type: string;
  meal_date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  enrichment_status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to FoodLog type
 */
function rowToFoodLog(row: FoodLogRow): FoodLog {
  return {
    id: row.id,
    foodName: row.food_name,
    quantity: row.quantity ?? undefined,
    mealType: row.meal_type as MealType,
    mealDate: row.meal_date,
    calories: row.calories ?? undefined,
    protein: row.protein ?? undefined,
    carbs: row.carbs ?? undefined,
    fat: row.fat ?? undefined,
    enrichmentStatus: row.enrichment_status as EnrichmentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new food log entry
 */
export async function createFoodLog(data: FoodLogCreate): Promise<FoodLog> {
  const mealDate = data.mealDate ?? getTodayISO();

  const result = run(
    `INSERT INTO food_logs (food_name, quantity, meal_type, meal_date, calories, protein, carbs, fat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.foodName,
      data.quantity ?? null,
      data.mealType,
      mealDate,
      data.calories ?? null,
      data.protein ?? null,
      data.carbs ?? null,
      data.fat ?? null,
    ]
  );

  const created = await getFoodLogById(result.lastID);
  if (!created) throw new Error('Failed to create food log');
  return created;
}

/**
 * Get a food log by ID
 */
export async function getFoodLogById(id: number): Promise<FoodLog | null> {
  const rows = query<FoodLogRow>('SELECT * FROM food_logs WHERE id = ?', [id]);
  const row = rows[0];
  return row ? rowToFoodLog(row) : null;
}

/**
 * Get all food logs with optional filters
 */
export async function getAllFoodLogs(filters: FilterOptions = {}): Promise<FoodLog[]> {
  let sql = 'SELECT * FROM food_logs WHERE 1=1';
  const params: unknown[] = [];

  if (filters.startDate) {
    sql += ' AND meal_date >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ' AND meal_date <= ?';
    params.push(filters.endDate);
  }

  sql += ' ORDER BY meal_date DESC, created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  const rows = query<FoodLogRow>(sql, params);
  return rows.map(rowToFoodLog);
}

/**
 * Get food logs for a specific date
 */
export async function getFoodLogsByDate(date: string): Promise<FoodLog[]> {
  const rows = query<FoodLogRow>(
    'SELECT * FROM food_logs WHERE meal_date = ? ORDER BY created_at',
    [date]
  );
  return rows.map(rowToFoodLog);
}

/**
 * Get food logs for today
 */
export async function getTodaysFoodLogs(): Promise<FoodLog[]> {
  return getFoodLogsByDate(getTodayISO());
}

/**
 * Update a food log
 */
export async function updateFoodLog(
  id: number,
  data: Partial<FoodLogCreate>
): Promise<FoodLog | null> {
  const existing = await getFoodLogById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.foodName !== undefined) {
    updates.push('food_name = ?');
    params.push(data.foodName);
  }
  if (data.quantity !== undefined) {
    updates.push('quantity = ?');
    params.push(data.quantity);
  }
  if (data.mealType !== undefined) {
    updates.push('meal_type = ?');
    params.push(data.mealType);
  }
  if (data.mealDate !== undefined) {
    updates.push('meal_date = ?');
    params.push(data.mealDate);
  }
  if (data.calories !== undefined) {
    updates.push('calories = ?');
    params.push(data.calories);
  }
  if (data.protein !== undefined) {
    updates.push('protein = ?');
    params.push(data.protein);
  }
  if (data.carbs !== undefined) {
    updates.push('carbs = ?');
    params.push(data.carbs);
  }
  if (data.fat !== undefined) {
    updates.push('fat = ?');
    params.push(data.fat);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  params.push(getNowISO());
  params.push(id);

  run(`UPDATE food_logs SET ${updates.join(', ')} WHERE id = ?`, params);

  return getFoodLogById(id);
}

/**
 * Update enrichment status
 */
export async function updateEnrichmentStatus(
  id: number,
  status: EnrichmentStatus
): Promise<void> {
  run('UPDATE food_logs SET enrichment_status = ?, updated_at = ? WHERE id = ?', [
    status,
    getNowISO(),
    id,
  ]);
}

/**
 * Delete a food log
 */
export async function deleteFoodLog(id: number): Promise<boolean> {
  const result = run('DELETE FROM food_logs WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Get daily nutrition summary
 */
export async function getDailyNutrition(date: string): Promise<{
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
}> {
  const rows = query<{
    total_calories: number | null;
    total_protein: number | null;
    total_carbs: number | null;
    total_fat: number | null;
    meal_count: number;
  }>(
    `SELECT
      SUM(calories) as total_calories,
      SUM(protein) as total_protein,
      SUM(carbs) as total_carbs,
      SUM(fat) as total_fat,
      COUNT(*) as meal_count
    FROM food_logs WHERE meal_date = ?`,
    [date]
  );

  const row = rows[0];
  return {
    totalCalories: row?.total_calories ?? 0,
    totalProtein: row?.total_protein ?? 0,
    totalCarbs: row?.total_carbs ?? 0,
    totalFat: row?.total_fat ?? 0,
    mealCount: row?.meal_count ?? 0,
  };
}
