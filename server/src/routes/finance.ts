/**
 * Finance routes
 *
 * REST endpoints for transaction management and financial analytics.
 */

import { Router, type Request, type Response } from 'express';
import {
  createTransaction,
  getTransactionById,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
  getPeriodSummary,
  getCategoryBreakdown,
} from '../services/finance/index.js';
import type { TransactionCreate, TransactionType } from '../types/domains.js';

const router = Router();

/**
 * GET /finance/transactions - List transactions with optional filters
 * Query params: startDate, endDate, limit, offset, category, type
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, limit, offset, category, type } = req.query;

    // Validate type if provided
    if (type && !['income', 'expense'].includes(type as string)) {
      res.status(400).json({ error: 'Type must be "income" or "expense"' });
      return;
    }

    const transactions = await getAllTransactions({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
      category: category as string | undefined,
      type: type as TransactionType | undefined,
    });

    res.json({
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error('[Finance] Error listing transactions:', error);
    res.status(500).json({
      error: 'Failed to list transactions',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /finance/transactions/:id - Get a single transaction
 */
router.get('/transactions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    const transaction = await getTransactionById(id);
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json(transaction);
  } catch (error) {
    console.error('[Finance] Error getting transaction:', error);
    res.status(500).json({
      error: 'Failed to get transaction',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /finance/transactions - Create a transaction
 */
router.post('/transactions', async (req: Request, res: Response) => {
  try {
    const data = req.body as TransactionCreate;

    if (!data.amount || typeof data.amount !== 'number') {
      res.status(400).json({ error: 'Amount is required and must be a number' });
      return;
    }

    if (!data.transactionType || !['income', 'expense'].includes(data.transactionType)) {
      res.status(400).json({ error: 'Transaction type must be "income" or "expense"' });
      return;
    }

    const transaction = await createTransaction(data);
    res.status(201).json(transaction);
  } catch (error) {
    console.error('[Finance] Error creating transaction:', error);
    res.status(500).json({
      error: 'Failed to create transaction',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /finance/transactions/:id - Update a transaction
 */
router.put('/transactions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    const data = req.body as Partial<TransactionCreate>;
    const transaction = await updateTransaction(id, data);

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json(transaction);
  } catch (error) {
    console.error('[Finance] Error updating transaction:', error);
    res.status(500).json({
      error: 'Failed to update transaction',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /finance/transactions/:id - Delete a transaction
 */
router.delete('/transactions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    const deleted = await deleteTransaction(id);
    if (!deleted) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json({ deleted: true, id });
  } catch (error) {
    console.error('[Finance] Error deleting transaction:', error);
    res.status(500).json({
      error: 'Failed to delete transaction',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /finance/summary - Get period summary
 * Query params: startDate, endDate (both required)
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'startDate and endDate are required' });
      return;
    }

    const summary = await getPeriodSummary(startDate as string, endDate as string);
    res.json(summary);
  } catch (error) {
    console.error('[Finance] Error getting summary:', error);
    res.status(500).json({
      error: 'Failed to get summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /finance/categories - Get category breakdown
 * Query params: startDate, endDate (optional)
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const breakdown = await getCategoryBreakdown(
      startDate as string | undefined,
      endDate as string | undefined
    );

    res.json({
      categories: breakdown,
      count: breakdown.length,
    });
  } catch (error) {
    console.error('[Finance] Error getting categories:', error);
    res.status(500).json({
      error: 'Failed to get category breakdown',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
