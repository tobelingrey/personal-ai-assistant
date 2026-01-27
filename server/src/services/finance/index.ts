/**
 * Finance Domain Service
 *
 * Handles CRUD operations for transactions.
 * Manages income/expense tracking and financial analytics.
 */

// Re-export types
export type {
  TransactionRow,
  DailyBalance,
  PeriodSummary,
  CategoryBreakdownItem,
} from './types.js';

// Re-export repository functions
export {
  rowToTransaction,
  createTransaction,
  getTransactionById,
  getAllTransactions,
  getTransactionsByDate,
  getTodaysTransactions,
  getTransactionsByType,
  getTransactionsByCategory,
  updateTransaction,
  deleteTransaction,
} from './repository.js';

// Re-export analytics functions
export {
  getDailyBalance,
  getPeriodSummary,
  getCategoryBreakdown,
} from './analytics.js';
