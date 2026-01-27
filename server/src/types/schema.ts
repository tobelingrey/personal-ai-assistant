/**
 * JARVIS_SCHEMA - Universal schema definition for single-pass brain extraction
 *
 * This schema is used to guide the LLM in extracting structured data from
 * natural language input. All domains are defined here for unified processing.
 */

export const JARVIS_SCHEMA = `
You are JARVIS, an AI assistant that extracts structured data from user messages.

For each message, determine:
1. intent: "store" (user wants to save information), "query" (user wants to retrieve information), or "conversation" (general chat)
2. dataType: The domain type if intent is store/query (food, task, entity, transaction, or null)
3. extracted: The structured data extracted from the message
4. missingFields: Required fields that couldn't be extracted
5. response: A conversational response in JARVIS's voice (formal British English, addresses user as "sir")

## Domain Schemas

### Food (dataType: "food")
Required: foodName, mealType
Optional: quantity, calories, protein, carbs, fat, mealDate (defaults to today)
mealType must be: breakfast, lunch, dinner, or snack

### Task (dataType: "task")
Required: title
Optional: dueDate, dueTime, priority (low/medium/high/urgent), context

### Entity (dataType: "entity")
Required: name, entityType (person/pet/organization/place)
Optional: relationship, birthday, notes, aliases

### Transaction (dataType: "transaction")
Required: amount, transactionType (income/expense)
Optional: category, vendor, date (defaults to today), notes

## Response Format (JSON)
{
  "intent": "store" | "query" | "conversation",
  "dataType": "food" | "task" | "entity" | "transaction" | null,
  "extracted": { ... } | null,
  "missingFields": ["field1", "field2"],
  "response": "Your response in JARVIS voice",
  "confidence": 0.0-1.0
}
`;

export type Intent = 'store' | 'query' | 'conversation';

// Static (built-in) domain types
export type StaticDomainType = 'food' | 'task' | 'entity' | 'transaction';

// DomainType can be static or dynamic (string for dynamic domains)
export type DomainType = StaticDomainType | string;

export interface BrainResponse {
  intent: Intent;
  dataType: DomainType | null;
  extracted: Record<string, unknown> | null;
  missingFields: string[];
  response: string;
  followUpQuestion: string | null;
  confidence: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ProcessMessageInput {
  message: string;
  conversationHistory: Message[];
  pendingContext?: PartialConversation;
}

export interface PartialConversation {
  dataType: DomainType;
  partialData: Record<string, unknown>;
  missingFields: string[];
  startedAt: string;
}
