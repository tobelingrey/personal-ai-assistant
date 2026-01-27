/**
 * Finance module internal types
 */

export interface TransactionRow {
  id: number;
  amount: number;
  transaction_type: string;
  category: string | null;
  vendor: string | null;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyBalance {
  income: number;
  expenses: number;
  net: number;
}

export interface PeriodSummary {
  income: number;
  expenses: number;
  net: number;
  count: number;
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  count: number;
}
