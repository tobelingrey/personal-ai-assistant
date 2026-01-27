/**
 * EvolutionPanel - Main panel for self-evolution system
 *
 * Shows pending entries, detected patterns, and schema proposals.
 * Allows users to review and approve new domains.
 */

import { useState, useEffect, useCallback } from 'react';
import { useEvolution, type PatternCluster, type SchemaProposal, type DeployedDomain } from '../../hooks/useEvolution';
import { PatternList } from './PatternList';
import { SchemaReviewPanel } from './SchemaReviewPanel';
import './EvolutionPanel.css';

interface EvolutionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'pending' | 'patterns' | 'proposals' | 'domains';

export function EvolutionPanel({ isOpen, onClose }: EvolutionPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [pendingCount, setPendingCount] = useState(0);
  const [embeddedCount, setEmbeddedCount] = useState(0);
  const [patterns, setPatterns] = useState<PatternCluster[]>([]);
  const [proposals, setProposals] = useState<SchemaProposal[]>([]);
  const [domains, setDomains] = useState<DeployedDomain[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<SchemaProposal | null>(null);

  const {
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
  } = useEvolution();

  // Refresh data when panel opens or tab changes
  const refreshData = useCallback(async () => {
    switch (activeTab) {
      case 'pending': {
        const data = await fetchPendingEntries();
        setPendingCount(data.total);
        setEmbeddedCount(data.embedded);
        break;
      }
      case 'patterns': {
        const p = await fetchPatterns();
        setPatterns(p);
        break;
      }
      case 'proposals': {
        const pr = await fetchProposals();
        setProposals(pr);
        break;
      }
      case 'domains': {
        const d = await fetchDomains();
        setDomains(d);
        break;
      }
    }
  }, [activeTab, fetchPendingEntries, fetchPatterns, fetchProposals, fetchDomains]);

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen, activeTab, refreshData]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedProposal) {
          setSelectedProposal(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedProposal, onClose]);

  const handleEmbed = async () => {
    const result = await embedPending();
    if (result.embedded > 0) {
      setEmbeddedCount(result.total);
    }
  };

  const handleProposeSchema = async (index: number) => {
    const proposal = await proposeSchema(index);
    if (proposal) {
      setSelectedProposal(proposal);
      setActiveTab('proposals');
      refreshData();
    }
  };

  const handleApprove = async (id: number) => {
    const success = await approveProposal(id);
    if (success) {
      refreshData();
    }
  };

  const handleReject = async (id: number) => {
    const success = await rejectProposal(id);
    if (success) {
      setSelectedProposal(null);
      refreshData();
    }
  };

  const handleDeploy = async (id: number) => {
    const success = await deployProposal(id);
    if (success) {
      setSelectedProposal(null);
      setActiveTab('domains');
      refreshData();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="evolution-overlay" onClick={onClose}>
      <div
        className="evolution-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evolution-title"
      >
        <div className="evolution-header">
          <h2 id="evolution-title">Self-Evolution</h2>
          <button
            className="evolution-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="evolution-tabs">
          <button
            className={`tab ${activeTab === 'pending' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({pendingCount})
          </button>
          <button
            className={`tab ${activeTab === 'patterns' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('patterns')}
          >
            Patterns ({patterns.length})
          </button>
          <button
            className={`tab ${activeTab === 'proposals' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('proposals')}
          >
            Proposals ({proposals.filter(p => p.status === 'pending').length})
          </button>
          <button
            className={`tab ${activeTab === 'domains' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('domains')}
          >
            Domains ({domains.length})
          </button>
        </div>

        <div className="evolution-content">
          {loading && <div className="loading">Loading...</div>}
          {error && <div className="error">{error}</div>}

          {activeTab === 'pending' && (
            <div className="pending-section">
              <p className="section-info">
                {pendingCount} unclassified messages captured.
                {embeddedCount < pendingCount && (
                  <> ({embeddedCount} embedded)</>
                )}
              </p>
              {pendingCount > 0 && embeddedCount < pendingCount && (
                <button
                  className="action-button"
                  onClick={handleEmbed}
                  disabled={loading}
                >
                  Embed All
                </button>
              )}
              {embeddedCount >= 3 && (
                <button
                  className="action-button action-button--secondary"
                  onClick={() => setActiveTab('patterns')}
                >
                  Detect Patterns
                </button>
              )}
            </div>
          )}

          {activeTab === 'patterns' && (
            <PatternList
              patterns={patterns}
              onPropose={handleProposeSchema}
              loading={loading}
            />
          )}

          {activeTab === 'proposals' && (
            <div className="proposals-section">
              {proposals.length === 0 ? (
                <p className="empty-state">No schema proposals yet.</p>
              ) : (
                <ul className="proposal-list">
                  {proposals.map((proposal) => (
                    <li
                      key={proposal.id}
                      className={`proposal-item proposal-item--${proposal.status}`}
                      onClick={() => setSelectedProposal(proposal)}
                    >
                      <span className="proposal-name">{proposal.domainName}</span>
                      <span className={`proposal-status status--${proposal.status}`}>
                        {proposal.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'domains' && (
            <div className="domains-section">
              {domains.length === 0 ? (
                <p className="empty-state">No dynamic domains deployed yet.</p>
              ) : (
                <ul className="domain-list">
                  {domains.map((domain) => (
                    <li key={domain.id} className="domain-item">
                      <span className="domain-name">{domain.name}</span>
                      <span className="domain-table">{domain.tableName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {selectedProposal && (
          <SchemaReviewPanel
            proposal={selectedProposal}
            onApprove={() => handleApprove(selectedProposal.id)}
            onReject={() => handleReject(selectedProposal.id)}
            onDeploy={() => handleDeploy(selectedProposal.id)}
            onClose={() => setSelectedProposal(null)}
          />
        )}
      </div>
    </div>
  );
}
