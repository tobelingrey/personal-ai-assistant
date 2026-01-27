/**
 * Entity module internal types
 */

export interface EntityRow {
  id: number;
  name: string;
  entity_type: string;
  relationship: string | null;
  birthday: string | null;
  notes: string | null;
  aliases: string | null; // JSON array
  created_at: string;
  updated_at: string;
}
