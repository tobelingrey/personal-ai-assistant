/**
 * Route aggregator
 *
 * Combines all routes and mounts them on the Express app.
 */

import { Router } from 'express';
import healthRouter from './health.js';
import chatRouter from './chat.js';
import financeRouter from './finance.js';
import evolutionRouter from './evolution.js';

const router = Router();

// Mount routes
router.use('/health', healthRouter);
router.use('/chat', chatRouter);
router.use('/finance', financeRouter);
router.use('/evolution', evolutionRouter);

// API info at root
router.get('/', (_req, res) => {
  res.json({
    name: 'Jarvis API',
    version: '0.1.0',
    endpoints: {
      health: 'GET /health',
      chat: 'POST /chat',
      chatHistory: 'GET /chat/history',
      clearHistory: 'DELETE /chat/history',
      financeTransactions: 'GET /finance/transactions',
      financeTransaction: 'GET /finance/transactions/:id',
      financeSummary: 'GET /finance/summary',
      financeCategories: 'GET /finance/categories',
      evolutionPending: 'GET /evolution/pending',
      evolutionPatterns: 'GET /evolution/patterns',
      evolutionProposals: 'GET /evolution/proposals',
      evolutionDomains: 'GET /evolution/domains',
    },
  });
});

export default router;
