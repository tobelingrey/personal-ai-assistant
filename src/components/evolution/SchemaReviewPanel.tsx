/**
 * SchemaReviewPanel - Review and approve/reject schema proposals
 */

import type { SchemaProposal } from '../../hooks/useEvolution';

interface SchemaReviewPanelProps {
  proposal: SchemaProposal;
  onApprove: () => void;
  onReject: () => void;
  onDeploy: () => void;
  onClose: () => void;
}

export function SchemaReviewPanel({
  proposal,
  onApprove,
  onReject,
  onDeploy,
  onClose,
}: SchemaReviewPanelProps) {
  const { schema, status } = proposal;

  return (
    <div className="schema-review-overlay" onClick={onClose}>
      <div
        className="schema-review-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schema-review-header">
          <h3>{schema.domainName}</h3>
          <span className={`status-badge status--${status}`}>{status}</span>
        </div>

        <p className="schema-description">{schema.description}</p>

        <div className="schema-fields">
          <h4>Required Fields</h4>
          {schema.requiredFields.length === 0 ? (
            <p className="no-fields">None</p>
          ) : (
            <ul className="field-list">
              {schema.requiredFields.map((field) => (
                <li key={field.name} className="field-item">
                  <span className="field-name">{field.name}</span>
                  <span className="field-type">{field.type}</span>
                  <span className="field-desc">{field.description}</span>
                </li>
              ))}
            </ul>
          )}

          <h4>Optional Fields</h4>
          {schema.optionalFields.length === 0 ? (
            <p className="no-fields">None</p>
          ) : (
            <ul className="field-list">
              {schema.optionalFields.map((field) => (
                <li key={field.name} className="field-item field-item--optional">
                  <span className="field-name">{field.name}</span>
                  <span className="field-type">{field.type}</span>
                  <span className="field-desc">{field.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="schema-source">
          <p className="source-info">
            Based on {proposal.clusterEntryIds.length} similar messages
          </p>
        </div>

        <div className="schema-actions">
          {status === 'pending' && (
            <>
              <button
                className="action-button action-button--danger"
                onClick={onReject}
              >
                Reject
              </button>
              <button
                className="action-button action-button--primary"
                onClick={onApprove}
              >
                Approve
              </button>
            </>
          )}
          {status === 'approved' && (
            <button
              className="action-button action-button--primary"
              onClick={onDeploy}
            >
              Deploy Domain
            </button>
          )}
          {status === 'deployed' && (
            <span className="deployed-notice">Domain is active</span>
          )}
          {status === 'rejected' && (
            <span className="rejected-notice">Proposal rejected</span>
          )}
          <button className="action-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
