'use client';

import { ArbiterClaim } from '@/types';
import ClaimCard from './ClaimCard';

interface ClaimsSidebarProps {
  claims: ArbiterClaim[];
  activeSectionId?: string | null;
  onClaimView?: (claimId: string) => void;
  onClaimClick?: (claimId: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function ClaimsSidebar({
  claims,
  activeSectionId,
  onClaimView,
  onClaimClick,
  collapsed,
  onToggle,
}: ClaimsSidebarProps) {
  // Sort: claims relevant to the active section first
  const sortedClaims = [...claims].sort((a, b) => {
    const aRelevant = activeSectionId ? a.relevantSectionIds.includes(activeSectionId) : false;
    const bRelevant = activeSectionId ? b.relevantSectionIds.includes(activeSectionId) : false;
    if (aRelevant && !bRelevant) return -1;
    if (!aRelevant && bRelevant) return 1;
    return 0;
  });

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 px-2 py-4 text-xs font-semibold rounded-l"
        style={{
          background: '#6366f1',
          color: '#fff',
          writingMode: 'vertical-rl',
        }}
      >
        Arbiter
      </button>
    );
  }

  return (
    <aside
      className="arbiter-sidebar h-full overflow-y-auto p-4"
      style={{ width: 350, flexShrink: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: '#6366f1' }}>
          Arbiter &mdash; Social Media Discourse
        </h2>
        <button
          onClick={onToggle}
          className="text-xs px-2 py-1 rounded"
          style={{
            border: '1px solid var(--wiki-chrome-border)',
            color: 'var(--wiki-text-secondary)',
          }}
        >
          Collapse
        </button>
      </div>

      {/* Claims list */}
      {sortedClaims.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--wiki-text-disabled)' }}>
          No claims available for this article.
        </p>
      )}

      {sortedClaims.map((claim) => {
        const isRelevant = activeSectionId
          ? claim.relevantSectionIds.includes(activeSectionId)
          : false;

        return (
          <ClaimCard
            key={claim.id}
            claim={claim}
            isRelevant={isRelevant}
            onView={onClaimView}
            onClick={onClaimClick}
          />
        );
      })}
    </aside>
  );
}
