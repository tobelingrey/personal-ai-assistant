/**
 * Dynamic Domain Service Factory
 *
 * Provides generic CRUD operations for any deployed dynamic domain.
 * Creates services on-the-fly based on the domain's schema.
 */

import { query, run } from './database.js';
import { getDomain } from './domainRegistry.js';
import type { DeployedDomain } from './dynamicSchema.js';
import type { FieldDefinition } from './schemaProposer.js';

export interface DynamicRecord {
  id: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

/**
 * Validate data against a domain's schema
 */
function validateData(
  domain: DeployedDomain,
  data: Record<string, unknown>,
  isUpdate: boolean = false
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const schema = domain.schema;

  // Check required fields (only for create, not update)
  if (!isUpdate) {
    for (const field of schema.requiredFields) {
      if (data[field.name] === undefined || data[field.name] === null) {
        errors.push(`Missing required field: ${field.name}`);
      }
    }
  }

  // Validate field types
  const allFields = [...schema.requiredFields, ...schema.optionalFields];
  for (const field of allFields) {
    const value = data[field.name];
    if (value === undefined || value === null) continue;

    if (!validateFieldType(value, field.type)) {
      errors.push(`Invalid type for ${field.name}: expected ${field.type}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a value against a field type
 */
function validateFieldType(value: unknown, type: FieldDefinition['type']): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      // Accept ISO date strings or Date objects
      if (typeof value === 'string') {
        return !isNaN(Date.parse(value));
      }
      return value instanceof Date;
    default:
      return true;
  }
}

/**
 * Build column list for INSERT/UPDATE
 */
function getSchemaColumns(domain: DeployedDomain): string[] {
  const schema = domain.schema;
  return [
    ...schema.requiredFields.map((f) => f.name),
    ...schema.optionalFields.map((f) => f.name),
  ];
}

/**
 * Create a record in a dynamic domain
 */
export function createDynamicRecord(
  domainName: string,
  data: Record<string, unknown>
): DynamicRecord {
  const domain = getDomain(domainName);
  if (!domain) {
    throw new Error(`Domain "${domainName}" not found`);
  }

  const validation = validateData(domain, data);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const columns = getSchemaColumns(domain);
  const presentColumns = columns.filter((col) => data[col] !== undefined);
  const values = presentColumns.map((col) => data[col]);

  const placeholders = presentColumns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${domain.tableName} (${presentColumns.join(', ')}) VALUES (${placeholders})`;

  const result = run(sql, values as (string | number | null)[]);

  console.log(`[DynamicDomain] Created record ${result.lastID} in ${domainName}`);

  return getDynamicRecordById(domainName, result.lastID)!;
}

/**
 * Get a record by ID from a dynamic domain
 */
export function getDynamicRecordById(
  domainName: string,
  id: number
): DynamicRecord | null {
  const domain = getDomain(domainName);
  if (!domain) {
    throw new Error(`Domain "${domainName}" not found`);
  }

  const rows = query<Record<string, unknown>>(
    `SELECT * FROM ${domain.tableName} WHERE id = ?`,
    [id]
  );

  if (rows.length === 0) return null;

  return rowToRecord(rows[0]!);
}

/**
 * Get all records from a dynamic domain
 */
export function getDynamicRecords(
  domainName: string,
  limit?: number
): DynamicRecord[] {
  const domain = getDomain(domainName);
  if (!domain) {
    throw new Error(`Domain "${domainName}" not found`);
  }

  const sql = limit
    ? `SELECT * FROM ${domain.tableName} ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM ${domain.tableName} ORDER BY created_at DESC`;
  const params = limit ? [limit] : [];

  const rows = query<Record<string, unknown>>(sql, params);
  return rows.map(rowToRecord);
}

/**
 * Update a record in a dynamic domain
 */
export function updateDynamicRecord(
  domainName: string,
  id: number,
  data: Record<string, unknown>
): DynamicRecord | null {
  const domain = getDomain(domainName);
  if (!domain) {
    throw new Error(`Domain "${domainName}" not found`);
  }

  const validation = validateData(domain, data, true);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const columns = getSchemaColumns(domain);
  const presentColumns = columns.filter((col) => data[col] !== undefined);

  if (presentColumns.length === 0) {
    return getDynamicRecordById(domainName, id);
  }

  const setClauses = presentColumns.map((col) => `${col} = ?`).join(', ');
  const values = presentColumns.map((col) => data[col]);
  values.push(id);

  const sql = `UPDATE ${domain.tableName} SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`;

  const result = run(sql, values as (string | number | null)[]);

  if (result.changes === 0) {
    return null;
  }

  console.log(`[DynamicDomain] Updated record ${id} in ${domainName}`);

  return getDynamicRecordById(domainName, id);
}

/**
 * Delete a record from a dynamic domain
 */
export function deleteDynamicRecord(domainName: string, id: number): boolean {
  const domain = getDomain(domainName);
  if (!domain) {
    throw new Error(`Domain "${domainName}" not found`);
  }

  const result = run(
    `DELETE FROM ${domain.tableName} WHERE id = ?`,
    [id]
  );

  if (result.changes > 0) {
    console.log(`[DynamicDomain] Deleted record ${id} from ${domainName}`);
  }

  return result.changes > 0;
}

/**
 * Get record count for a dynamic domain
 */
export function getDynamicRecordCount(domainName: string): number {
  const domain = getDomain(domainName);
  if (!domain) {
    throw new Error(`Domain "${domainName}" not found`);
  }

  const result = query<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${domain.tableName}`,
    []
  );
  return result[0]?.count ?? 0;
}

/**
 * Convert database row to DynamicRecord
 */
function rowToRecord(row: Record<string, unknown>): DynamicRecord {
  return {
    id: row.id as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    ...row,
  };
}
