/**
 * Reprocessing Service
 *
 * After a new domain is deployed, reprocesses pending entries
 * through the brain to extract data into the new domain.
 */

import { processMessage } from './brain.js';
import {
  getPendingEntriesByIds,
  deletePendingEntries,
  type PendingEntry,
} from './pendingEntries.js';
import { deleteEmbedding } from './patternDetection.js';
import { createDynamicRecord } from './dynamicDomainService.js';
import { hasDomain } from './domainRegistry.js';

export interface ReprocessResult {
  entryId: number;
  message: string;
  success: boolean;
  savedId?: number;
  error?: string;
}

export interface ReprocessSummary {
  total: number;
  successful: number;
  failed: number;
  results: ReprocessResult[];
}

/**
 * Reprocess pending entries through the brain with a new domain available
 *
 * @param entryIds IDs of pending entries to reprocess
 * @param newDomainName The newly deployed domain name
 * @returns Summary of reprocessing results
 */
export async function reprocessPendingEntries(
  entryIds: number[],
  newDomainName: string
): Promise<ReprocessSummary> {
  if (!hasDomain(newDomainName)) {
    throw new Error(`Domain "${newDomainName}" is not deployed`);
  }

  const entries = getPendingEntriesByIds(entryIds);
  const results: ReprocessResult[] = [];
  const successfulIds: number[] = [];

  for (const entry of entries) {
    const result = await reprocessEntry(entry, newDomainName);
    results.push(result);

    if (result.success) {
      successfulIds.push(entry.id);
    }
  }

  // Clean up successfully reprocessed entries
  if (successfulIds.length > 0) {
    // Delete embeddings first (due to foreign key)
    for (const id of successfulIds) {
      deleteEmbedding(id);
    }
    // Then delete the entries
    deletePendingEntries(successfulIds);
  }

  const summary: ReprocessSummary = {
    total: entries.length,
    successful: successfulIds.length,
    failed: entries.length - successfulIds.length,
    results,
  };

  console.log(
    `[Reprocessing] Completed: ${summary.successful}/${summary.total} entries migrated to "${newDomainName}"`
  );

  return summary;
}

/**
 * Reprocess a single entry
 */
async function reprocessEntry(
  entry: PendingEntry,
  targetDomain: string
): Promise<ReprocessResult> {
  try {
    // Process the message through the brain again
    const brainResponse = await processMessage({
      message: entry.message,
      conversationHistory: [],
    });

    // Check if the brain now classifies it as the target domain
    if (
      brainResponse.intent === 'store' &&
      brainResponse.dataType === targetDomain &&
      brainResponse.extracted
    ) {
      // Save to the dynamic domain
      const record = createDynamicRecord(targetDomain, brainResponse.extracted);

      return {
        entryId: entry.id,
        message: entry.message,
        success: true,
        savedId: record.id,
      };
    }

    // Brain didn't classify as the target domain
    return {
      entryId: entry.id,
      message: entry.message,
      success: false,
      error: `Classified as ${brainResponse.intent}/${brainResponse.dataType ?? 'none'} instead of store/${targetDomain}`,
    };
  } catch (error) {
    return {
      entryId: entry.id,
      message: entry.message,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Preview which entries would be reprocessed
 * Useful for showing user what will happen before committing
 */
export function previewReprocessing(entryIds: number[]): PendingEntry[] {
  return getPendingEntriesByIds(entryIds);
}
