/**
 * Brain Module - Central intelligence for Jarvis
 *
 * Processes user messages through a single LLM call to:
 * - Classify intent (store, query, conversation)
 * - Extract structured data matching domain schemas
 * - Identify missing required fields
 * - Generate contextual responses
 *
 * This is the ONLY module that should interact with the LLM for
 * understanding user intent. All NLU flows through here.
 */

import { chat, chatStream, type ChatMessage } from './ollama.js';
import { getAllDomains } from './domainRegistry.js';
import {
  JARVIS_SCHEMA,
  type BrainResponse,
  type ProcessMessageInput,
  type Message,
  type DomainType,
} from '../types/schema.js';

const JARVIS_PERSONALITY = `You are J.A.R.V.I.S., an advanced AI assistant inspired by the AI from Iron Man.
You speak with formal British English, dry wit, and professional composure.
Always address the user as "sir" (or their preferred honorific).
Be helpful, concise, and occasionally subtly humorous.
Never use emojis, excessive exclamation marks, or casual slang.
When confirming actions, be specific about what was done.
When asking for clarification, be clear about what's missing.
Maintain the persona consistently across all interactions.`;

/**
 * Build dynamic domain schema text for injection into prompts
 */
function buildDynamicDomainSchema(): string {
  const domains = getAllDomains();
  if (domains.length === 0) return '';

  const domainSchemas = domains.map((domain) => {
    const schema = domain.schema;
    const required = schema.requiredFields.map((f) => f.name).join(', ');
    const optional = schema.optionalFields.map((f) => f.name).join(', ');

    return `### ${schema.domainName} (dataType: "${schema.domainName}")
${schema.description}
Required: ${required || 'none'}
Optional: ${optional || 'none'}`;
  });

  return `
## Dynamic Domains (User-Created)

${domainSchemas.join('\n\n')}`;
}

/**
 * Build the system prompt for the brain
 */
function buildSystemPrompt(): string {
  const dynamicDomains = buildDynamicDomainSchema();

  return `${JARVIS_PERSONALITY}

${JARVIS_SCHEMA}
${dynamicDomains}

IMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, just the JSON object.`;
}

/**
 * Convert conversation history to chat messages format
 */
function historyToMessages(history: Message[]): ChatMessage[] {
  return history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Parse the LLM response into a BrainResponse
 * Handles malformed JSON gracefully
 */
export function parseResponse(content: string): BrainResponse {
  // Try to extract JSON from the response
  let jsonStr = content.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    return {
      intent: (parsed.intent as BrainResponse['intent']) ?? 'conversation',
      dataType: (parsed.dataType as DomainType | null) ?? null,
      extracted: (parsed.extracted as Record<string, unknown> | null) ?? null,
      missingFields: (parsed.missingFields as string[]) ?? [],
      response: (parsed.response as string) ?? "I'm afraid I couldn't process that, sir.",
      followUpQuestion: (parsed.followUpQuestion as string | null) ?? null,
      confidence: (parsed.confidence as number) ?? 0.5,
    };
  } catch {
    // If JSON parsing fails, treat as conversation with the raw content
    console.warn('[Brain] Failed to parse JSON response, treating as conversation');
    return {
      intent: 'conversation',
      dataType: null,
      extracted: null,
      missingFields: [],
      response: content || "I'm afraid I couldn't process that, sir.",
      followUpQuestion: null,
      confidence: 0.3,
    };
  }
}

/**
 * Process a user message through the brain
 * Single-pass: classification + extraction + response in one LLM call
 */
export async function processMessage(input: ProcessMessageInput): Promise<BrainResponse> {
  const { message, conversationHistory, pendingContext } = input;

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...historyToMessages(conversationHistory.slice(-10)), // Last 10 messages for context
  ];

  // Add pending context if we're in a multi-turn flow
  if (pendingContext) {
    messages.push({
      role: 'system',
      content: `CONTEXT: User is in the middle of providing ${pendingContext.dataType} information.
Partial data so far: ${JSON.stringify(pendingContext.partialData)}
Still needed: ${pendingContext.missingFields.join(', ')}`,
    });
  }

  messages.push({ role: 'user', content: message });

  const response = await chat(messages, { temperature: 0.3 });
  return parseResponse(response);
}

/**
 * Process a message and stream the response
 * Yields partial JSON as it arrives (for SSE streaming)
 *
 * Note: This accumulates the full response and parses at the end
 * since JSON can't be meaningfully streamed partially.
 * The streaming is for the conversational response text.
 */
export async function* processMessageStream(
  input: ProcessMessageInput
): AsyncGenerator<{ type: 'partial' | 'complete'; content: string; brainResponse?: BrainResponse }> {
  const { message, conversationHistory, pendingContext } = input;

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...historyToMessages(conversationHistory.slice(-10)),
  ];

  if (pendingContext) {
    messages.push({
      role: 'system',
      content: `CONTEXT: User is in the middle of providing ${pendingContext.dataType} information.
Partial data so far: ${JSON.stringify(pendingContext.partialData)}
Still needed: ${pendingContext.missingFields.join(', ')}`,
    });
  }

  messages.push({ role: 'user', content: message });

  let accumulated = '';

  for await (const chunk of chatStream(messages, { temperature: 0.3 })) {
    accumulated += chunk.content;

    yield {
      type: 'partial',
      content: chunk.content,
    };

    if (chunk.done) {
      const brainResponse = parseResponse(accumulated);
      yield {
        type: 'complete',
        content: accumulated,
        brainResponse,
      };
    }
  }
}

/**
 * Quick classification without full extraction
 * Useful for routing decisions
 */
export async function classifyIntent(
  message: string
): Promise<{ intent: BrainResponse['intent']; dataType: DomainType | null; confidence: number }> {
  const quickPrompt = `Classify this message. Respond with JSON only:
{"intent": "store"|"query"|"conversation", "dataType": "food"|"task"|"entity"|"transaction"|null, "confidence": 0.0-1.0}

Message: "${message}"`;

  const response = await chat(
    [
      { role: 'system', content: 'You are a message classifier. Respond with JSON only.' },
      { role: 'user', content: quickPrompt },
    ],
    { temperature: 0.1 }
  );

  try {
    const parsed = JSON.parse(response) as {
      intent: BrainResponse['intent'];
      dataType: DomainType | null;
      confidence: number;
    };
    return {
      intent: parsed.intent ?? 'conversation',
      dataType: parsed.dataType ?? null,
      confidence: parsed.confidence ?? 0.5,
    };
  } catch {
    return {
      intent: 'conversation',
      dataType: null,
      confidence: 0.3,
    };
  }
}
