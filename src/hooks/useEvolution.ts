/**
 * Evolution hook - API for self-evolution system
 */

import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:3001';

export interface PendingEntry {
  id: number;
  message: string;
  confidence: number;
  createdAt: string;
}

export interface PatternCluster {
  centroidEntryId: number;
  entryIds: number[];
  messages: string[];
  avgSimilarity: number;
}

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

export interface DeployedDomain {
  id: number;
  name: string;
  tableName: string;
  schema: ProposedSchema;
  deployedAt: string;
}

export function useEvolution() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch pending entries
  const fetchPendingEntries = useCallback(async (): Promise<{
    entries: PendingEntry[];
    total: number;
    embedded: number;
  }> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/evolution/pending`);
      if (!res.ok) throw new Error('Failed to fetch pending entries');
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return { entries: [], total: 0, embedded: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  // Detect patterns
  const fetchPatterns = useCallback(async (
    minSize = 3,
    threshold = 0.75
  ): Promise<PatternCluster[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/evolution/patterns?minSize=${minSize}&threshold=${threshold}`
      );
      if (!res.ok) throw new Error('Failed to detect patterns');
      const data = await res.json();
      return data.patterns;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Embed all pending entries
  const embedPending = useCallback(async (): Promise<{ embedded: number; total: number }> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/evolution/patterns/embed`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to embed entries');
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return { embedded: 0, total: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  // Propose schema for a pattern
  const proposeSchema = useCallback(async (
    patternIndex: number
  ): Promise<SchemaProposal | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/evolution/patterns/${patternIndex}/propose`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to propose schema');
      const data = await res.json();
      return data.proposal;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch proposals
  const fetchProposals = useCallback(async (
    status?: SchemaProposal['status']
  ): Promise<SchemaProposal[]> => {
    setLoading(true);
    setError(null);
    try {
      const url = status
        ? `${API_BASE}/evolution/proposals?status=${status}`
        : `${API_BASE}/evolution/proposals`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch proposals');
      const data = await res.json();
      return data.proposals;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Approve proposal
  const approveProposal = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/evolution/proposals/${id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to approve proposal');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Reject proposal
  const rejectProposal = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/evolution/proposals/${id}/reject`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to reject proposal');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Deploy proposal
  const deployProposal = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/evolution/proposals/${id}/deploy`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to deploy proposal');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch deployed domains
  const fetchDomains = useCallback(async (): Promise<DeployedDomain[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/evolution/domains`);
      if (!res.ok) throw new Error('Failed to fetch domains');
      const data = await res.json();
      return data.domains;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchPendingEntries,
    fetchPatterns,
    embedPending,
    proposeSchema,
    fetchProposals,
    approveProposal,
    rejectProposal,
    deployProposal,
    fetchDomains,
  };
}
