/**
 * Task Domain Service
 *
 * Handles CRUD operations for tasks and reminders.
 */

import { query, run, getTodayISO, getNowISO } from './database.js';
import type {
  Task,
  TaskCreate,
  FilterOptions,
  TaskPriority,
  TaskStatus,
} from '../types/domains.js';

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: string;
  status: string;
  context: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * Convert database row to Task type
 */
function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date ?? undefined,
    dueTime: row.due_time ?? undefined,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    context: row.context ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

/**
 * Create a new task
 */
export async function createTask(data: TaskCreate): Promise<Task> {
  const result = run(
    `INSERT INTO tasks (title, description, due_date, due_time, priority, context)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.description ?? null,
      data.dueDate ?? null,
      data.dueTime ?? null,
      data.priority ?? 'medium',
      data.context ?? null,
    ]
  );

  const created = await getTaskById(result.lastID);
  if (!created) throw new Error('Failed to create task');
  return created;
}

/**
 * Get a task by ID
 */
export async function getTaskById(id: number): Promise<Task | null> {
  const rows = query<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  const row = rows[0];
  return row ? rowToTask(row) : null;
}

/**
 * Get all tasks with optional filters
 */
export async function getAllTasks(filters: FilterOptions = {}): Promise<Task[]> {
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: unknown[] = [];

  if (filters.startDate) {
    sql += ' AND due_date >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ' AND due_date <= ?';
    params.push(filters.endDate);
  }

  sql += ' ORDER BY due_date ASC NULLS LAST, priority DESC, created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  const rows = query<TaskRow>(sql, params);
  return rows.map(rowToTask);
}

/**
 * Get pending tasks (not completed or cancelled)
 */
export async function getPendingTasks(): Promise<Task[]> {
  const rows = query<TaskRow>(
    `SELECT * FROM tasks
     WHERE status IN ('pending', 'in_progress')
     ORDER BY due_date ASC NULLS LAST, priority DESC`,
    []
  );
  return rows.map(rowToTask);
}

/**
 * Get tasks due on a specific date
 */
export async function getTasksByDueDate(date: string): Promise<Task[]> {
  const rows = query<TaskRow>(
    'SELECT * FROM tasks WHERE due_date = ? ORDER BY due_time ASC NULLS LAST, priority DESC',
    [date]
  );
  return rows.map(rowToTask);
}

/**
 * Get tasks due today
 */
export async function getTodaysTasks(): Promise<Task[]> {
  return getTasksByDueDate(getTodayISO());
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(): Promise<Task[]> {
  const today = getTodayISO();
  const rows = query<TaskRow>(
    `SELECT * FROM tasks
     WHERE due_date < ? AND status IN ('pending', 'in_progress')
     ORDER BY due_date ASC, priority DESC`,
    [today]
  );
  return rows.map(rowToTask);
}

/**
 * Update a task
 */
export async function updateTask(
  id: number,
  data: Partial<TaskCreate & { status: TaskStatus }>
): Promise<Task | null> {
  const existing = await getTaskById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    params.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.dueDate !== undefined) {
    updates.push('due_date = ?');
    params.push(data.dueDate);
  }
  if (data.dueTime !== undefined) {
    updates.push('due_time = ?');
    params.push(data.dueTime);
  }
  if (data.priority !== undefined) {
    updates.push('priority = ?');
    params.push(data.priority);
  }
  if (data.context !== undefined) {
    updates.push('context = ?');
    params.push(data.context);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);

    if (data.status === 'completed') {
      updates.push('completed_at = ?');
      params.push(getNowISO());
    }
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  params.push(getNowISO());
  params.push(id);

  run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params);

  return getTaskById(id);
}

/**
 * Mark a task as completed
 */
export async function completeTask(id: number): Promise<Task | null> {
  return updateTask(id, { status: 'completed' });
}

/**
 * Delete a task
 */
export async function deleteTask(id: number): Promise<boolean> {
  const result = run('DELETE FROM tasks WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Get task counts by status
 */
export async function getTaskStats(): Promise<{
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}> {
  const today = getTodayISO();

  const statusCounts = query<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM tasks GROUP BY status`,
    []
  );

  const overdueCounts = query<{ count: number }>(
    `SELECT COUNT(*) as count FROM tasks
     WHERE due_date < ? AND status IN ('pending', 'in_progress')`,
    [today]
  );

  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) {
    statusMap[row.status] = row.count;
  }

  return {
    pending: statusMap['pending'] ?? 0,
    inProgress: statusMap['in_progress'] ?? 0,
    completed: statusMap['completed'] ?? 0,
    overdue: overdueCounts[0]?.count ?? 0,
  };
}
