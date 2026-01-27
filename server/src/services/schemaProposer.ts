/**
 * Schema Proposer Service
 *
 * Uses LLM to analyze clusters of similar unclassified messages
 * and propose new domain schemas. These proposals can be reviewed
 * by the user and deployed as new data types.
 */

import { query, run } from './database.js';
import { chat } from './ollama.js';
import type { PatternCluster } from './patternDetection.js';

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  description: string;
}

export interface ProposedSchema {
  domainName: string;
  description: string;
  requiredFields: FieldDefinition[];
  optionalFields: FieldDefinition[];
}

export interface SchemaProposal {
  id: number;
  domainName: string;
  description: string;
  schema: ProposedSchema;
  clusterEntryIds: number[];
  status: 'pending' | 'approved' | 'rejected' | 'deployed';
  createdAt: string;
}

interface SchemaProposalRow {
  id: number;
  domain_name: string;
  description: string;
  schema_json: string;
  cluster_entry_ids: string;
  status: string;
  created_at: string;
}

const SCHEMA_PROPOSAL_PROMPT = `You are analyzing a cluster of similar user messages that Jarvis couldn't classify into existing domains.
Your task is to propose a new domain schema that would allow Jarvis to extract structured data from these messages.

Existing domains are: food (meals/eating), task (reminders/todos), entity (people/places/organizations), transaction (money/spending).

Analyze these messages and propose a NEW domain schema. The domain should be:
1. Distinct from existing domains
2. Useful for tracking/organizing information
3. Have clear, extractable fields

Messages to analyze:
{{MESSAGES}}

Respond with ONLY valid JSON in this exact format:
{
  "domainName": "lowercase_snake_case_name",
  "description": "Brief description of what this domain tracks",
  "requiredFields": [
    {"name": "field_name", "type": "string|number|boolean|date", "required": true, "description": "Field description"}
  ],
  "optionalFields": [
    {"name": "field_name", "type": "string|number|boolean|date", "required": false, "description": "Field description"}
  ]
}

Requirements:
- domainName must be lowercase with underscores (e.g., "workout_log", "book_note")
- At least 1 required field
- type must be one of: string, number, boolean, date
- Avoid overlapping with existing domains
- Keep it focused (3-6 total fields)`;

/**
 * Propose a schema for a cluster of messages
 */
export async function proposeSchema(cluster: PatternCluster): Promise<ProposedSchema> {
  const messagesText = cluster.messages
    .map((m, i) => `${i + 1}. "${m}"`)
    .join('\n');

  const prompt = SCHEMA_PROPOSAL_PROMPT.replace('{{MESSAGES}}', messagesText);

  const response = await chat([
    { role: 'system', content: prompt },
    { role: 'user', content: 'Analyze these messages and propose a domain schema.' },
  ]);

  // Parse the response
  const schema = parseSchemaResponse(response);

  return schema;
}

/**
 * Parse LLM response into ProposedSchema
 */
function parseSchemaResponse(response: string): ProposedSchema {
  // Strip markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned) as ProposedSchema;

    // Validate required fields exist
    if (!parsed.domainName || typeof parsed.domainName !== 'string') {
      throw new Error('Missing or invalid domainName');
    }
    if (!parsed.description || typeof parsed.description !== 'string') {
      throw new Error('Missing or invalid description');
    }
    if (!Array.isArray(parsed.requiredFields)) {
      parsed.requiredFields = [];
    }
    if (!Array.isArray(parsed.optionalFields)) {
      parsed.optionalFields = [];
    }

    // Normalize domain name
    parsed.domainName = parsed.domainName.toLowerCase().replace(/\s+/g, '_');

    return parsed;
  } catch (error) {
    console.error('[SchemaProposer] Failed to parse response:', response);
    throw new Error(`Failed to parse schema response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save a schema proposal to the database
 */
export function saveSchemaProposal(
  schema: ProposedSchema,
  clusterEntryIds: number[]
): SchemaProposal {
  const schemaJson = JSON.stringify(schema);
  const entryIdsJson = JSON.stringify(clusterEntryIds);

  const result = run(
    `INSERT INTO schema_proposals (domain_name, description, schema_json, cluster_entry_ids, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
    [schema.domainName, schema.description, schemaJson, entryIdsJson]
  );

  const proposal: SchemaProposal = {
    id: result.lastID,
    domainName: schema.domainName,
    description: schema.description,
    schema,
    clusterEntryIds,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  console.log(`[SchemaProposer] Created proposal ${proposal.id} for domain "${schema.domainName}"`);

  return proposal;
}

/**
 * Get all schema proposals
 */
export function getSchemaProposals(status?: SchemaProposal['status']): SchemaProposal[] {
  const sql = status
    ? 'SELECT * FROM schema_proposals WHERE status = ? ORDER BY created_at DESC'
    : 'SELECT * FROM schema_proposals ORDER BY created_at DESC';
  const params = status ? [status] : [];

  const rows = query<SchemaProposalRow>(sql, params);
  return rows.map(rowToProposal);
}

/**
 * Get a single schema proposal by ID
 */
export function getSchemaProposalById(id: number): SchemaProposal | null {
  const rows = query<SchemaProposalRow>(
    'SELECT * FROM schema_proposals WHERE id = ?',
    [id]
  );
  return rows.length > 0 ? rowToProposal(rows[0]!) : null;
}

/**
 * Update proposal status
 */
export function updateProposalStatus(
  id: number,
  status: SchemaProposal['status']
): boolean {
  const result = run(
    'UPDATE schema_proposals SET status = ? WHERE id = ?',
    [status, id]
  );

  if (result.changes > 0) {
    console.log(`[SchemaProposer] Updated proposal ${id} status to "${status}"`);
  }

  return result.changes > 0;
}

/**
 * Delete a schema proposal
 */
export function deleteSchemaProposal(id: number): boolean {
  const result = run('DELETE FROM schema_proposals WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Propose and save schema for a cluster in one step
 */
export async function proposeAndSaveSchema(cluster: PatternCluster): Promise<SchemaProposal> {
  const schema = await proposeSchema(cluster);
  return saveSchemaProposal(schema, cluster.entryIds);
}

/**
 * Convert database row to SchemaProposal
 */
function rowToProposal(row: SchemaProposalRow): SchemaProposal {
  return {
    id: row.id,
    domainName: row.domain_name,
    description: row.description,
    schema: JSON.parse(row.schema_json) as ProposedSchema,
    clusterEntryIds: JSON.parse(row.cluster_entry_ids) as number[],
    status: row.status as SchemaProposal['status'],
    createdAt: row.created_at,
  };
}
