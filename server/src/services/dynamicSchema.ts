/**
 * Dynamic Schema Service
 *
 * Generates and deploys database tables for user-approved domain schemas.
 * Enables Jarvis to store data in dynamically created domains.
 */

import { query, run, getDatabase, saveDatabase } from './database.js';
import {
  getSchemaProposalById,
  updateProposalStatus,
  type ProposedSchema,
  type FieldDefinition,
} from './schemaProposer.js';

export interface DeployedDomain {
  id: number;
  name: string;
  tableName: string;
  schema: ProposedSchema;
  deployedAt: string;
}

interface DeployedDomainRow {
  id: number;
  name: string;
  table_name: string;
  schema_json: string;
  deployed_at: string;
}

/**
 * Map schema field types to SQLite types
 */
function getSqliteType(fieldType: FieldDefinition['type']): string {
  switch (fieldType) {
    case 'string':
      return 'TEXT';
    case 'number':
      return 'REAL';
    case 'boolean':
      return 'INTEGER'; // SQLite uses 0/1 for boolean
    case 'date':
      return 'TEXT'; // Store dates as ISO strings
    default:
      return 'TEXT';
  }
}

/**
 * Generate SQL for creating a table from a schema
 */
export function generateTableSQL(schema: ProposedSchema): string {
  const tableName = `dynamic_${schema.domainName}`;
  const columns: string[] = [
    'id INTEGER PRIMARY KEY AUTOINCREMENT',
  ];

  // Add required fields
  for (const field of schema.requiredFields) {
    const sqlType = getSqliteType(field.type);
    columns.push(`${field.name} ${sqlType} NOT NULL`);
  }

  // Add optional fields
  for (const field of schema.optionalFields) {
    const sqlType = getSqliteType(field.type);
    columns.push(`${field.name} ${sqlType}`);
  }

  // Add standard timestamp columns
  columns.push("created_at TEXT NOT NULL DEFAULT (datetime('now'))");
  columns.push("updated_at TEXT NOT NULL DEFAULT (datetime('now'))");

  return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columns.join(',\n  ')}\n)`;
}

/**
 * Deploy a schema proposal - creates the table and registers the domain
 */
export function deploySchema(proposalId: number): DeployedDomain {
  const proposal = getSchemaProposalById(proposalId);
  if (!proposal) {
    throw new Error(`Schema proposal ${proposalId} not found`);
  }

  if (proposal.status === 'deployed') {
    throw new Error(`Schema proposal ${proposalId} is already deployed`);
  }

  if (proposal.status === 'rejected') {
    throw new Error(`Schema proposal ${proposalId} has been rejected`);
  }

  const schema = proposal.schema;
  const tableName = `dynamic_${schema.domainName}`;

  // Check if domain already exists
  const existing = getDomainByName(schema.domainName);
  if (existing) {
    throw new Error(`Domain "${schema.domainName}" already exists`);
  }

  // Create the table
  const createTableSQL = generateTableSQL(schema);
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  try {
    db.run(createTableSQL);
    saveDatabase();
    console.log(`[DynamicSchema] Created table ${tableName}`);
  } catch (error) {
    console.error(`[DynamicSchema] Failed to create table:`, error);
    throw new Error(`Failed to create table: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Register the domain
  const schemaJson = JSON.stringify(schema);
  const result = run(
    `INSERT INTO deployed_domains (name, table_name, schema_json, deployed_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [schema.domainName, tableName, schemaJson]
  );

  // Update proposal status
  updateProposalStatus(proposalId, 'deployed');

  const domain: DeployedDomain = {
    id: result.lastID,
    name: schema.domainName,
    tableName,
    schema,
    deployedAt: new Date().toISOString(),
  };

  console.log(`[DynamicSchema] Deployed domain "${schema.domainName}" (table: ${tableName})`);

  return domain;
}

/**
 * Get all deployed domains
 */
export function getDeployedDomains(): DeployedDomain[] {
  const rows = query<DeployedDomainRow>(
    'SELECT * FROM deployed_domains ORDER BY deployed_at DESC',
    []
  );
  return rows.map(rowToDomain);
}

/**
 * Get a deployed domain by name
 */
export function getDomainByName(name: string): DeployedDomain | null {
  const rows = query<DeployedDomainRow>(
    'SELECT * FROM deployed_domains WHERE name = ?',
    [name]
  );
  return rows.length > 0 ? rowToDomain(rows[0]!) : null;
}

/**
 * Get a deployed domain by ID
 */
export function getDomainById(id: number): DeployedDomain | null {
  const rows = query<DeployedDomainRow>(
    'SELECT * FROM deployed_domains WHERE id = ?',
    [id]
  );
  return rows.length > 0 ? rowToDomain(rows[0]!) : null;
}

/**
 * Check if a table exists in the database
 */
export function tableExists(tableName: string): boolean {
  const rows = query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [tableName]
  );
  return rows.length > 0;
}

/**
 * Convert database row to DeployedDomain
 */
function rowToDomain(row: DeployedDomainRow): DeployedDomain {
  return {
    id: row.id,
    name: row.name,
    tableName: row.table_name,
    schema: JSON.parse(row.schema_json) as ProposedSchema,
    deployedAt: row.deployed_at,
  };
}
