/**
 * Evolution API Routes
 *
 * Endpoints for managing Jarvis's self-evolution system:
 * - View detected patterns in pending entries
 * - Review and approve/reject schema proposals
 * - Deploy new domains
 * - Reprocess pending entries
 */

import { Router, type Request, type Response } from 'express';
import {
  getPendingEntries,
  getPendingEntryCount,
  deletePendingEntry,
} from '../services/pendingEntries.js';
import {
  detectPatterns,
  embedAllPending,
  getEmbeddingCount,
  initializePatternDetection,
} from '../services/patternDetection.js';
import {
  getSchemaProposals,
  getSchemaProposalById,
  updateProposalStatus,
  proposeAndSaveSchema,
} from '../services/schemaProposer.js';
import { deploySchema, getDeployedDomains } from '../services/dynamicSchema.js';
import { registerDomain, getAllDomains } from '../services/domainRegistry.js';
import { reprocessPendingEntries, previewReprocessing } from '../services/reprocessing.js';

const router = Router();

// ============================================================================
// Pending Entries
// ============================================================================

/**
 * GET /evolution/pending - List pending entries
 */
router.get('/pending', (_req: Request, res: Response) => {
  try {
    const entries = getPendingEntries(100);
    const count = getPendingEntryCount();
    const embeddingCount = getEmbeddingCount();

    res.json({
      entries,
      total: count,
      embedded: embeddingCount,
    });
  } catch (error) {
    console.error('[Evolution] Error getting pending entries:', error);
    res.status(500).json({ error: 'Failed to get pending entries' });
  }
});

/**
 * DELETE /evolution/pending/:id - Delete a pending entry
 */
router.delete('/pending/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid entry ID' });
      return;
    }

    const deleted = deletePendingEntry(id);
    res.json({ deleted });
  } catch (error) {
    console.error('[Evolution] Error deleting pending entry:', error);
    res.status(500).json({ error: 'Failed to delete pending entry' });
  }
});

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * GET /evolution/patterns - Detect patterns in pending entries
 */
router.get('/patterns', (req: Request, res: Response) => {
  try {
    const minSize = parseInt(req.query.minSize as string, 10) || 3;
    const threshold = parseFloat(req.query.threshold as string) || 0.75;

    const patterns = detectPatterns(minSize, threshold);

    res.json({
      patterns,
      count: patterns.length,
      params: { minSize, threshold },
    });
  } catch (error) {
    console.error('[Evolution] Error detecting patterns:', error);
    res.status(500).json({ error: 'Failed to detect patterns' });
  }
});

/**
 * POST /evolution/patterns/embed - Embed all pending entries
 */
router.post('/patterns/embed', async (_req: Request, res: Response) => {
  try {
    await initializePatternDetection();
    const embedded = await embedAllPending();

    res.json({
      embedded,
      total: getEmbeddingCount(),
    });
  } catch (error) {
    console.error('[Evolution] Error embedding entries:', error);
    res.status(500).json({ error: 'Failed to embed entries' });
  }
});

/**
 * POST /evolution/patterns/:index/propose - Generate schema proposal for a pattern
 */
router.post('/patterns/:index/propose', async (req: Request, res: Response) => {
  try {
    const index = parseInt(req.params.index, 10);
    const minSize = parseInt(req.query.minSize as string, 10) || 3;
    const threshold = parseFloat(req.query.threshold as string) || 0.75;

    const patterns = detectPatterns(minSize, threshold);

    if (index < 0 || index >= patterns.length) {
      res.status(404).json({ error: 'Pattern not found' });
      return;
    }

    const cluster = patterns[index]!;
    const proposal = await proposeAndSaveSchema(cluster);

    res.json({ proposal });
  } catch (error) {
    console.error('[Evolution] Error proposing schema:', error);
    res.status(500).json({
      error: 'Failed to propose schema',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

// ============================================================================
// Schema Proposals
// ============================================================================

/**
 * GET /evolution/proposals - List schema proposals
 */
router.get('/proposals', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const validStatuses = ['pending', 'approved', 'rejected', 'deployed'];

    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const proposals = getSchemaProposals(status as 'pending' | 'approved' | 'rejected' | 'deployed' | undefined);

    res.json({ proposals });
  } catch (error) {
    console.error('[Evolution] Error getting proposals:', error);
    res.status(500).json({ error: 'Failed to get proposals' });
  }
});

/**
 * GET /evolution/proposals/:id - Get a specific proposal
 */
router.get('/proposals/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    const proposal = getSchemaProposalById(id);
    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    res.json({ proposal });
  } catch (error) {
    console.error('[Evolution] Error getting proposal:', error);
    res.status(500).json({ error: 'Failed to get proposal' });
  }
});

/**
 * POST /evolution/proposals/:id/approve - Approve a proposal
 */
router.post('/proposals/:id/approve', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    const proposal = getSchemaProposalById(id);
    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    if (proposal.status !== 'pending') {
      res.status(400).json({ error: `Cannot approve proposal with status "${proposal.status}"` });
      return;
    }

    updateProposalStatus(id, 'approved');

    res.json({ success: true, status: 'approved' });
  } catch (error) {
    console.error('[Evolution] Error approving proposal:', error);
    res.status(500).json({ error: 'Failed to approve proposal' });
  }
});

/**
 * POST /evolution/proposals/:id/reject - Reject a proposal
 */
router.post('/proposals/:id/reject', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    const proposal = getSchemaProposalById(id);
    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    if (proposal.status !== 'pending') {
      res.status(400).json({ error: `Cannot reject proposal with status "${proposal.status}"` });
      return;
    }

    updateProposalStatus(id, 'rejected');

    res.json({ success: true, status: 'rejected' });
  } catch (error) {
    console.error('[Evolution] Error rejecting proposal:', error);
    res.status(500).json({ error: 'Failed to reject proposal' });
  }
});

/**
 * POST /evolution/proposals/:id/deploy - Deploy an approved proposal
 */
router.post('/proposals/:id/deploy', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid proposal ID' });
      return;
    }

    const proposal = getSchemaProposalById(id);
    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    if (proposal.status !== 'approved') {
      res.status(400).json({
        error: `Cannot deploy proposal with status "${proposal.status}". Must be approved first.`,
      });
      return;
    }

    const domain = deploySchema(id);
    registerDomain(domain);

    res.json({
      success: true,
      domain: {
        id: domain.id,
        name: domain.name,
        tableName: domain.tableName,
      },
    });
  } catch (error) {
    console.error('[Evolution] Error deploying proposal:', error);
    res.status(500).json({
      error: 'Failed to deploy proposal',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

// ============================================================================
// Deployed Domains
// ============================================================================

/**
 * GET /evolution/domains - List deployed dynamic domains
 */
router.get('/domains', (_req: Request, res: Response) => {
  try {
    const domains = getAllDomains();
    res.json({ domains });
  } catch (error) {
    console.error('[Evolution] Error getting domains:', error);
    res.status(500).json({ error: 'Failed to get domains' });
  }
});

// ============================================================================
// Reprocessing
// ============================================================================

/**
 * POST /evolution/reprocess - Reprocess pending entries through a new domain
 */
router.post('/reprocess', async (req: Request, res: Response) => {
  try {
    const { entryIds, domainName } = req.body as {
      entryIds: number[];
      domainName: string;
    };

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      res.status(400).json({ error: 'entryIds must be a non-empty array' });
      return;
    }

    if (!domainName || typeof domainName !== 'string') {
      res.status(400).json({ error: 'domainName is required' });
      return;
    }

    const summary = await reprocessPendingEntries(entryIds, domainName);

    res.json({ summary });
  } catch (error) {
    console.error('[Evolution] Error reprocessing entries:', error);
    res.status(500).json({
      error: 'Failed to reprocess entries',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

/**
 * POST /evolution/reprocess/preview - Preview entries that would be reprocessed
 */
router.post('/reprocess/preview', (req: Request, res: Response) => {
  try {
    const { entryIds } = req.body as { entryIds: number[] };

    if (!Array.isArray(entryIds)) {
      res.status(400).json({ error: 'entryIds must be an array' });
      return;
    }

    const entries = previewReprocessing(entryIds);

    res.json({ entries });
  } catch (error) {
    console.error('[Evolution] Error previewing reprocessing:', error);
    res.status(500).json({ error: 'Failed to preview reprocessing' });
  }
});

export default router;
