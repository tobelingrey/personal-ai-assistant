/**
 * PatternList - Displays detected patterns in pending entries
 */

import type { PatternCluster } from '../../hooks/useEvolution';

interface PatternListProps {
  patterns: PatternCluster[];
  onPropose: (index: number) => void;
  loading: boolean;
}

export function PatternList({ patterns, onPropose, loading }: PatternListProps) {
  if (patterns.length === 0) {
    return (
      <div className="patterns-empty">
        <p className="empty-state">
          No patterns detected yet. Need at least 3 similar messages to form a pattern.
        </p>
        <p className="empty-hint">
          Continue chatting with Jarvis to build up unclassified messages.
        </p>
      </div>
    );
  }

  return (
    <div className="patterns-section">
      <p className="section-info">
        Found {patterns.length} pattern{patterns.length !== 1 ? 's' : ''} in your messages.
      </p>
      <ul className="pattern-list">
        {patterns.map((pattern, index) => (
          <li key={pattern.centroidEntryId} className="pattern-item">
            <div className="pattern-header">
              <span className="pattern-count">
                {pattern.entryIds.length} messages
              </span>
              <span className="pattern-similarity">
                {Math.round(pattern.avgSimilarity * 100)}% similar
              </span>
            </div>
            <div className="pattern-messages">
              {pattern.messages.slice(0, 3).map((msg, i) => (
                <p key={i} className="pattern-message">"{msg}"</p>
              ))}
              {pattern.messages.length > 3 && (
                <p className="pattern-more">
                  +{pattern.messages.length - 3} more
                </p>
              )}
            </div>
            <button
              className="action-button action-button--small"
              onClick={() => onPropose(index)}
              disabled={loading}
            >
              Propose Schema
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
