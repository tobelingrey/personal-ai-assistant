/**
 * Finance repository - CRUD and query operations
 */

import { query, run, getTodayISO, getNowISO } from '../database.js';
import type {
  Transaction,
  TransactionCreate,
  TransactionType,
} from '../../types/domains.js';
import type { TransactionFilters } from '@jarvis/core';
import type { TransactionRow } from './types.js';

/**
 * Convert database row to Transaction type
 */
export function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    amount: row.amount,
    transactionType: row.transaction_type as TransactionType,
    category: row.category ?? undefined,
    vendor: row.vendor ?? undefined,
    date: row.date,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new transaction
 */
export async function createTransaction(data: TransactionCreate): Promise<Transaction> {
  const date = data.date ?? getTodayISO();

  const result = run(
    `INSERT INTO transactions (amount, transaction_type, category, vendor, date, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.amount,
      data.transactionType,
      data.category ?? null,
      data.vendor ?? null,
      date,
      data.notes ?? null,
    ]
  );

  const created = await getTransactionById(result.lastID);
  if (!created) throw new Error('Failed to create transaction');
  return created;
}

/**
 * Get a transaction by ID
 */
export async function getTransactionById(id: number): Promise<Transaction | null> {
  const rows = query<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
  const row = rows[0];
  return row ? rowToTransaction(row) : null;
}

/**
 * Get all transactions with optional filters
 */
export async function getAllTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  let sql = 'SELECT * FROM transactions WHERE 1=1';
  const params: unknown[] = [];

  if (filters.startDate) {
    sql += ' AND date >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ' AND date <= ?';
    params.push(filters.endDate);
  }

  if (filters.category) {
    sql += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.type) {
    sql += ' AND transaction_type = ?';
    params.push(filters.type);
  }

  sql += ' ORDER BY date DESC, created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  const rows = query<TransactionRow>(sql, params);
  return rows.map(rowToTransaction);
}

/**
 * Get transactions for a specific date
 */
export async function getTransactionsByDate(date: string): Promise<Transaction[]> {
  const rows = query<TransactionRow>(
    'SELECT * FROM transactions WHERE date = ? ORDER BY created_at',
    [date]
  );
  return rows.map(rowToTransaction);
}

/**
 * Get transactions for today
 */
export async function getTodaysTransactions(): Promise<Transaction[]> {
  return getTransactionsByDate(getTodayISO());
}

/**
 * Get transactions by type (income or expense)
 */
export async function getTransactionsByType(type: TransactionType): Promise<Transaction[]> {
  const rows = query<TransactionRow>(
    'SELECT * FROM transactions WHERE transaction_type = ? ORDER BY date DESC, created_at DESC',
    [type]
  );
  return rows.map(rowToTransaction);
}

/**
 * Get transactions by category
 */
export async function getTransactionsByCategory(category: string): Promise<Transaction[]> {
  const rows = query<TransactionRow>(
    'SELECT * FROM transactions WHERE category = ? ORDER BY date DESC, created_at DESC',
    [category]
  );
  return rows.map(rowToTransaction);
}

/**
 * Update a transaction
 */
export async function updateTransaction(
  id: number,
  data: Partial<TransactionCreate>
): Promise<Transaction | null> {
  const existing = await getTransactionById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.amount !== undefined) {
    updates.push('amount = ?');
    params.push(data.amount);
  }
  if (data.transactionType !== undefined) {
    updates.push('transaction_type = ?');
    params.push(data.transactionType);
  }
  if (data.category !== undefined) {
    updates.push('category = ?');
    params.push(data.category);
  }
  if (data.vendor !== undefined) {
    updates.push('vendor = ?');
    params.push(data.vendor);
  }
  if (data.date !== undefined) {
    updates.push('date = ?');
    params.push(data.date);
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    params.push(data.notes);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  params.push(getNowISO());
  params.push(id);

  run(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`, params);

  return getTransactionById(id);
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(id: number): Promise<boolean> {
  const result = run('DELETE FROM transactions WHERE id = ?', [id]);
  return result.changes > 0;
}
