/**
 * Finance analytics - aggregation and summary functions
 */

import { query } from '../database.js';
import type { DailyBalance, PeriodSummary, CategoryBreakdownItem } from './types.js';

/**
 * Get daily balance summary
 */
export async function getDailyBalance(date: string): Promise<DailyBalance> {
  const rows = query<{
    transaction_type: string;
    total: number;
  }>(
    `SELECT transaction_type, SUM(amount) as total
     FROM transactions
     WHERE date = ?
     GROUP BY transaction_type`,
    [date]
  );

  let income = 0;
  let expenses = 0;

  for (const row of rows) {
    if (row.transaction_type === 'income') {
      income = row.total;
    } else if (row.transaction_type === 'expense') {
      expenses = row.total;
    }
  }

  return {
    income,
    expenses,
    net: income - expenses,
  };
}

/**
 * Get summary for a date range
 */
export async function getPeriodSummary(
  startDate: string,
  endDate: string
): Promise<PeriodSummary> {
  const rows = query<{
    transaction_type: string;
    total: number;
    count: number;
  }>(
    `SELECT transaction_type, SUM(amount) as total, COUNT(*) as count
     FROM transactions
     WHERE date >= ? AND date <= ?
     GROUP BY transaction_type`,
    [startDate, endDate]
  );

  let income = 0;
  let expenses = 0;
  let count = 0;

  for (const row of rows) {
    count += row.count;
    if (row.transaction_type === 'income') {
      income = row.total;
    } else if (row.transaction_type === 'expense') {
      expenses = row.total;
    }
  }

  return {
    income,
    expenses,
    net: income - expenses,
    count,
  };
}

/**
 * Get breakdown by category for a date range
 */
export async function getCategoryBreakdown(
  startDate?: string,
  endDate?: string
): Promise<CategoryBreakdownItem[]> {
  let sql = `SELECT
      COALESCE(category, 'uncategorized') as category,
      SUM(amount) as total,
      COUNT(*) as count
     FROM transactions
     WHERE transaction_type = 'expense'`;
  const params: unknown[] = [];

  if (startDate) {
    sql += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND date <= ?';
    params.push(endDate);
  }

  sql += ' GROUP BY category ORDER BY total DESC';

  const rows = query<{
    category: string;
    total: number;
    count: number;
  }>(sql, params);

  return rows.map((row) => ({
    category: row.category,
    total: row.total,
    count: row.count,
  }));
}
