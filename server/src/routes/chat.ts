/**
 * Chat route with SSE streaming
 *
 * Main conversation endpoint. Processes messages through the brain
 * and streams responses using Server-Sent Events.
 */

import { Router, type Request, type Response } from 'express';
import { processMessage, processMessageStream } from '../services/brain.js';
import { createFoodLog } from '../services/food.js';
import { createTask } from '../services/task.js';
import { createEntity } from '../services/entity/index.js';
import { createTransaction } from '../services/finance/index.js';
import { resolveEntity } from '../services/entityResolution.js';
import { createPendingEntry } from '../services/pendingEntries.js';
import { embedPendingEntry } from '../services/patternDetection.js';
import { hasDomain } from '../services/domainRegistry.js';
import { createDynamicRecord } from '../services/dynamicDomainService.js';
import type { BrainResponse, Message, StaticDomainType } from '../types/schema.js';
import type { FoodLogCreate, TaskCreate, EntityCreate, TransactionCreate, TransactionType } from '../types/domains.js';

// Static domain types that have hardcoded handlers
const STATIC_DOMAINS: StaticDomainType[] = ['food', 'task', 'entity', 'transaction'];

// Confidence threshold below which we capture messages for pattern detection
const PENDING_ENTRY_THRESHOLD = 0.8;

const router = Router();

// In-memory conversation history (would be in DB/session in production)
const conversationHistory: Message[] = [];

/**
 * Handle extracted data based on intent and data type
 */
interface ExtractedDataResult {
  saved: boolean;
  id?: number;
  error?: string;
  disambiguationRequired?: boolean;
  candidates?: Array<{ id: number; name: string; relationship?: string }>;
}

/**
 * Capture low-confidence conversation messages for pattern detection
 * These may contain patterns that could become new domains
 */
async function captureForEvolution(message: string, brainResponse: BrainResponse): Promise<void> {
  if (
    brainResponse.intent === 'conversation' &&
    brainResponse.confidence < PENDING_ENTRY_THRESHOLD
  ) {
    try {
      const entry = createPendingEntry(message, brainResponse);
      // Embed asynchronously (don't await to avoid slowing response)
      embedPendingEntry(entry.id, message).catch((err) => {
        console.error('[Chat] Failed to embed pending entry:', err);
      });
    } catch (error) {
      // Don't fail the request if capture fails
      console.error('[Chat] Failed to capture pending entry:', error);
    }
  }
}

async function handleExtractedData(
  brainResponse: BrainResponse
): Promise<ExtractedDataResult> {
  if (brainResponse.intent !== 'store' || !brainResponse.dataType || !brainResponse.extracted) {
    return { saved: false };
  }

  const extracted = brainResponse.extracted;

  try {
    switch (brainResponse.dataType) {
      case 'food': {
        const foodData: FoodLogCreate = {
          foodName: extracted.foodName as string,
          quantity: extracted.quantity as string | undefined,
          mealType: extracted.mealType as FoodLogCreate['mealType'],
          mealDate: extracted.mealDate as string | undefined,
          calories: extracted.calories as number | undefined,
          protein: extracted.protein as number | undefined,
          carbs: extracted.carbs as number | undefined,
          fat: extracted.fat as number | undefined,
        };
        const foodLog = await createFoodLog(foodData);
        return { saved: true, id: foodLog.id };
      }

      case 'task': {
        const taskData: TaskCreate = {
          title: extracted.title as string,
          description: extracted.description as string | undefined,
          dueDate: extracted.dueDate as string | undefined,
          dueTime: extracted.dueTime as string | undefined,
          priority: extracted.priority as TaskCreate['priority'],
          context: extracted.context as string | undefined,
        };
        const task = await createTask(taskData);
        return { saved: true, id: task.id };
      }

      case 'entity': {
        const name = extracted.name as string;
        const entityType = extracted.entityType as EntityCreate['entityType'];

        // Use entity resolution to check for existing matches
        const resolution = await resolveEntity({ mention: name, entityType });

        switch (resolution.action) {
          case 'linked':
            // Entity already exists - return existing ID
            return { saved: false, id: resolution.entity!.id };

          case 'ask':
            // Ambiguous match - return candidates for disambiguation
            return {
              saved: false,
              disambiguationRequired: true,
              candidates: resolution.candidates?.map((c) => ({
                id: c.id,
                name: c.name,
                relationship: c.relationship,
              })),
            };

          case 'new':
          default: {
            // No match found - create new entity
            const entityData: EntityCreate = {
              name,
              entityType,
              relationship: extracted.relationship as string | undefined,
              birthday: extracted.birthday as string | undefined,
              notes: extracted.notes as string | undefined,
              aliases: extracted.aliases as string[] | undefined,
            };
            const entity = await createEntity(entityData);
            return { saved: true, id: entity.id };
          }
        }
      }

      case 'transaction': {
        const transactionData: TransactionCreate = {
          amount: extracted.amount as number,
          transactionType: extracted.transactionType as TransactionType,
          category: extracted.category as string | undefined,
          vendor: extracted.vendor as string | undefined,
          date: extracted.date as string | undefined,
          notes: extracted.notes as string | undefined,
        };
        const transaction = await createTransaction(transactionData);
        return { saved: true, id: transaction.id };
      }

      default: {
        // Check if this is a dynamic domain
        const domainName = brainResponse.dataType as string;
        if (!STATIC_DOMAINS.includes(domainName as StaticDomainType) && hasDomain(domainName)) {
          const record = createDynamicRecord(domainName, extracted);
          return { saved: true, id: record.id };
        }
        return { saved: false };
      }
    }
  } catch (error) {
    console.error('[Chat] Error saving extracted data:', error);
    return { saved: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * POST /chat - Main chat endpoint
 *
 * Request body: { message: string, stream?: boolean }
 * Response: BrainResponse (or SSE stream if stream=true)
 */
router.post('/', async (req: Request, res: Response) => {
  const { message, stream = false } = req.body as { message: string; stream?: boolean };

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // Add user message to history
  const userMessage: Message = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  };
  conversationHistory.push(userMessage);

  // Trim history to last 50 messages
  while (conversationHistory.length > 50) {
    conversationHistory.shift();
  }

  if (stream) {
    // SSE streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      let brainResponse: BrainResponse | undefined;

      for await (const chunk of processMessageStream({
        message,
        conversationHistory: conversationHistory.slice(0, -1), // Exclude current message
      })) {
        if (chunk.type === 'partial') {
          res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'complete' && chunk.brainResponse) {
          brainResponse = chunk.brainResponse;
        }
      }

      if (brainResponse) {
        // Handle data persistence
        const saveResult = await handleExtractedData(brainResponse);

        // Capture low-confidence conversations for evolution
        captureForEvolution(message, brainResponse);

        // Add assistant message to history
        const assistantMessage: Message = {
          role: 'assistant',
          content: brainResponse.response,
          timestamp: new Date().toISOString(),
        };
        conversationHistory.push(assistantMessage);

        // Send final response
        res.write(
          `data: ${JSON.stringify({
            type: 'complete',
            brainResponse,
            saved: saveResult.saved,
            savedId: saveResult.id,
          })}\n\n`
        );
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      console.error('[Chat] Streaming error:', error);
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: 'Processing failed' })}\n\n`
      );
      res.end();
    }
  } else {
    // Standard JSON response
    try {
      const brainResponse = await processMessage({
        message,
        conversationHistory: conversationHistory.slice(0, -1),
      });

      // Handle data persistence
      const saveResult = await handleExtractedData(brainResponse);

      // Capture low-confidence conversations for evolution
      captureForEvolution(message, brainResponse);

      // Add assistant message to history
      const assistantMessage: Message = {
        role: 'assistant',
        content: brainResponse.response,
        timestamp: new Date().toISOString(),
      };
      conversationHistory.push(assistantMessage);

      res.json({
        ...brainResponse,
        saved: saveResult.saved,
        savedId: saveResult.id,
      });
    } catch (error) {
      console.error('[Chat] Error:', error);
      res.status(500).json({
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

/**
 * GET /chat/history - Get conversation history
 */
router.get('/history', (_req: Request, res: Response) => {
  res.json({
    messages: conversationHistory,
    count: conversationHistory.length,
  });
});

/**
 * DELETE /chat/history - Clear conversation history
 */
router.delete('/history', (_req: Request, res: Response) => {
  conversationHistory.length = 0;
  res.json({ cleared: true });
});

export default router;
