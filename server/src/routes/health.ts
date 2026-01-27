/**
 * Health check route
 *
 * Provides system health information including database and Ollama status.
 */

import { Router } from 'express';
import { checkHealth as checkOllama } from '../services/ollama.js';
import { getDatabase } from '../services/database.js';

const router = Router();

router.get('/', async (_req, res) => {
  const ollamaHealth = await checkOllama();
  const dbConnected = getDatabase() !== null;

  const status = {
    status: ollamaHealth.available && dbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        connected: dbConnected,
      },
      ollama: {
        available: ollamaHealth.available,
        modelLoaded: ollamaHealth.modelLoaded,
        error: ollamaHealth.error,
      },
    },
  };

  const httpStatus = status.status === 'ok' ? 200 : 503;
  res.status(httpStatus).json(status);
});

export default router;
