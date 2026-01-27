/**
 * Jarvis Server - Express Application Entry Point
 *
 * Local-first AI personal assistant backend.
 * Processes natural language through the brain module,
 * persists structured data, and streams responses.
 */

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDatabase, closeDatabase } from './services/database.js';
import { checkHealth as checkOllama } from './services/ollama.js';
import { loadDomainsFromDB } from './services/domainRegistry.js';
import { initializePatternDetection } from './services/patternDetection.js';
import routes from './routes/index.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Mount routes
app.use('/', routes);

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[Server] Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: config.nodeEnv === 'development' ? err.message : undefined,
    });
  }
);

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
  closeDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
async function start(): Promise<void> {
  console.log('[Server] Starting Jarvis...');

  // Initialize database
  try {
    await initDatabase();
    console.log('[Server] Database initialized');
  } catch (error) {
    console.error('[Server] Database initialization failed:', error);
    process.exit(1);
  }

  // Initialize self-evolution system
  try {
    loadDomainsFromDB();
    await initializePatternDetection();
  } catch (error) {
    // Non-fatal - evolution system can initialize later
    console.warn('[Server] Evolution system initialization skipped:', error);
  }

  // Check Ollama (non-blocking)
  const ollamaHealth = await checkOllama();
  if (ollamaHealth.available) {
    console.log(`[Server] Ollama connected (model: ${config.ollamaModel})`);
    if (!ollamaHealth.modelLoaded) {
      console.warn(
        `[Server] Warning: Model ${config.ollamaModel} not loaded. First request may be slow.`
      );
    }
  } else {
    console.warn(
      '[Server] Warning: Ollama not available. Chat functionality will not work.'
    );
    console.warn(`[Server] Ollama error: ${ollamaHealth.error}`);
  }

  // Start listening
  app.listen(config.port, config.host, () => {
    console.log(`[Server] Jarvis listening on http://${config.host}:${config.port}`);
    console.log('[Server] Ready to assist, sir.');
  });
}

start().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});
