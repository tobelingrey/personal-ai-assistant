/**
 * Database service using sql.js (SQLite compiled to WebAssembly)
 *
 * Provides a unified interface for database operations.
 * All data stays local - no network calls.
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

let db: SqlJsDatabase | null = null;

/**
 * Migrations array - add new migrations to the end
 * Each migration runs in order on first startup
 */
const migrations: { name: string; sql: string }[] = [
  // 001_initial.sql content is loaded separately in runInitialSchema
  {
    name: '002_add_filter_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_food_logs_meal_type ON food_logs(meal_type);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    `,
  },
];

/**
 * Initialize the database
 * Creates tables if they don't exist, runs migrations
 */
export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // Ensure data directory exists
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(config.dbPath)) {
    const buffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Run initial schema
  await runInitialSchema();

  // Run any pending migrations
  await runPendingMigrations();

  // Save database
  saveDatabase();

  console.log('[Database] Initialized successfully');
}

/**
 * Run the initial schema creation
 */
async function runInitialSchema(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // Create migrations tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Check if initial schema has been applied
  const result = db.exec("SELECT name FROM migrations WHERE name = '001_initial'");
  if (result.length > 0 && result[0]?.values.length) {
    return; // Already applied
  }

  // Apply initial schema
  db.run(`
    -- Food logs table
    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_name TEXT NOT NULL,
      quantity TEXT,
      meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
      meal_date TEXT NOT NULL,
      calories INTEGER,
      protein REAL,
      carbs REAL,
      fat REAL,
      enrichment_status TEXT NOT NULL DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'complete', 'failed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      due_time TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      context TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- Entities table (people, places, organizations)
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'pet', 'organization', 'place')),
      relationship TEXT,
      birthday TEXT,
      notes TEXT,
      aliases TEXT, -- JSON array
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Transactions table
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
      category TEXT,
      vendor TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_food_logs_meal_date ON food_logs(meal_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

    -- Entity embeddings for vector search / entity resolution
    CREATE TABLE IF NOT EXISTS entity_embeddings (
      entity_id INTEGER PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
      embedding BLOB NOT NULL,
      text_embedded TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Pending entries for self-evolution (unclassified messages)
    CREATE TABLE IF NOT EXISTS pending_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      brain_response TEXT NOT NULL,
      confidence REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pending_confidence ON pending_entries(confidence);

    -- Embeddings for pending entries (pattern detection)
    CREATE TABLE IF NOT EXISTS pending_entry_embeddings (
      entry_id INTEGER PRIMARY KEY REFERENCES pending_entries(id) ON DELETE CASCADE,
      embedding BLOB NOT NULL
    );

    -- Schema proposals for self-evolution
    CREATE TABLE IF NOT EXISTS schema_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_name TEXT NOT NULL,
      description TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      cluster_entry_ids TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','deployed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Deployed dynamic domains
    CREATE TABLE IF NOT EXISTS deployed_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      table_name TEXT NOT NULL UNIQUE,
      schema_json TEXT NOT NULL,
      deployed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Record migration
  db.run("INSERT INTO migrations (name) VALUES ('001_initial')");

  console.log('[Database] Applied initial schema');
}

/**
 * Run any pending migrations from the migrations array
 */
async function runPendingMigrations(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  for (const migration of migrations) {
    // Check if migration has been applied
    const result = db.exec(`SELECT name FROM migrations WHERE name = '${migration.name}'`);
    if (result.length > 0 && result[0]?.values.length) {
      continue; // Already applied
    }

    // Apply migration
    db.run(migration.sql);
    db.run(`INSERT INTO migrations (name) VALUES ('${migration.name}')`);
    console.log(`[Database] Applied migration: ${migration.name}`);
  }
}

/**
 * Save database to disk
 */
export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.dbPath, buffer);
}

/**
 * Execute a query that returns rows
 */
export function query<T>(sql: string, params: unknown[] = []): T[] {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);

  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as T;
    results.push(row);
  }
  stmt.free();

  return results;
}

/**
 * Execute a query that modifies data
 * Returns the last inserted row ID
 */
export function run(sql: string, params: unknown[] = []): { lastID: number; changes: number } {
  if (!db) throw new Error('Database not initialized');

  db.run(sql, params as (string | number | null | Uint8Array)[]);

  // Get last insert ID and changes
  const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
  const changesResult = db.exec('SELECT changes() as changes');

  const lastID = (lastIdResult[0]?.values[0]?.[0] as number) ?? 0;
  const changes = (changesResult[0]?.values[0]?.[0] as number) ?? 0;

  // Auto-save after modifications
  saveDatabase();

  return { lastID, changes };
}

/**
 * Get the raw database instance (for testing)
 */
export function getDatabase(): SqlJsDatabase | null {
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Get current datetime in ISO format
 */
export function getNowISO(): string {
  return new Date().toISOString();
}
