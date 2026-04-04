'use client';

import { useMemo } from 'react';
import { ArbiterClaim } from '@/types';
import ClaimCard from './ClaimCard';

interface ClaimsSidebarProps {
  claims: ArbiterClaim[];
  activeSectionId?: string | null;
  sectionTitles?: Record<string, string>; // sectionId -> section title
  onClaimView?: (claimId: string) => void;
  onClaimClick?: (claimId: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function ClaimsSidebar({
  claims,
  activeSectionId,
  sectionTitles = {},
  onClaimView,
  onClaimClick,
  collapsed,
  onToggle,
}: ClaimsSidebarProps) {
  // Filter to only show claims relevant to the active section
  const relevantClaims = useMemo(() => {
    if (!activeSectionId) return [];
    return claims.filter((c) => c.relevantSectionIds.includes(activeSectionId));
  }, [claims, activeSectionId]);

  // Count claims per section for the overview
  const claimCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    claims.forEach((c) => {
      c.relevantSectionIds.forEach((sid) => {
        counts[sid] = (counts[sid] || 0) + 1;
      });
    });
    return counts;
  }, [claims]);

  // Total engagement across all claims
  const totalEngagement = useMemo(() => {
    return claims.reduce((sum, c) => {
      return sum + (c.engagement.likes || 0) + (c.engagement.shares || 0) + (c.engagement.comments || 0) + (c.engagement.views || 0);
    }, 0);
  }, [claims]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 px-2 py-4 text-xs font-semibold rounded-l cursor-pointer"
        style={{
          background: '#6366f1',
          color: '#fff',
          writingMode: 'vertical-rl',
        }}
      >
        Arbiter ({claims.length} claims)
      </button>
    );
  }

  const activeSectionTitle = activeSectionId ? sectionTitles[activeSectionId] || activeSectionId : null;

  return (
    <aside
      className="arbiter-sidebar h-screen overflow-y-auto p-4 sticky top-0"
      style={{ width: 370, flexShrink: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: '#6366f1' }}>
          Arbiter &mdash; Social Media Discourse
        </h2>
        <button
          onClick={onToggle}
          className="text-xs px-2 py-1 rounded cursor-pointer"
          style={{
            border: '1px solid var(--wiki-chrome-border)',
            color: 'var(--wiki-text-secondary)',
          }}
        >
          Collapse
        </button>
      </div>

      {/* Summary stats */}
      <div
        className="text-xs mb-4 p-2 rounded"
        style={{ background: '#f0f0ff', color: 'var(--wiki-text-secondary)' }}
      >
        <strong>{claims.length}</strong> claims tracked across platforms
        {totalEngagement > 0 && (
          <> &middot; <strong>{(totalEngagement / 1000).toFixed(0)}K</strong> total interactions</>
        )}
      </div>

      {/* Active section context */}
      {activeSectionId ? (
        <>
          <div
            className="text-xs font-semibold mb-2 px-2 py-1 rounded"
            style={{
              background: '#eef2ff',
              color: '#4338ca',
              border: '1px solid #c7d2fe',
            }}
          >
            Claims related to: &ldquo;{activeSectionTitle}&rdquo;
          </div>

          {relevantClaims.length > 0 ? (
            <div className="space-y-0">
              {relevantClaims.map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  isRelevant={true}
                  onView={onClaimView}
                  onClick={onClaimClick}
                />
              ))}
            </div>
          ) : (
            <p
              className="text-xs py-4 text-center"
              style={{ color: 'var(--wiki-text-disabled)' }}
            >
              No claims found related to this section.
              <br />
              Click [edit] on a different section to see related claims.
            </p>
          )}

          {/* Divider showing other sections with claims */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--wiki-chrome-border)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--wiki-text-secondary)' }}>
              Other sections with claims
            </div>
            {Object.entries(claimCounts)
              .filter(([sid]) => sid !== activeSectionId)
              .sort(([, a], [, b]) => b - a)
              .map(([sid, count]) => (
                <div
                  key={sid}
                  className="text-xs py-1 flex justify-between"
                  style={{ color: 'var(--wiki-text-secondary)' }}
                >
                  <span>{sectionTitles[sid] || sid}</span>
                  <span
                    className="px-1.5 py-0.5 rounded"
                    style={{ background: '#eef2ff', color: '#4338ca', fontSize: '0.7rem' }}
                  >
                    {count} {count === 1 ? 'claim' : 'claims'}
                  </span>
                </div>
              ))}
          </div>
        </>
      ) : (
        <>
          {/* No section selected — show overview */}
          <p
            className="text-xs mb-3"
            style={{ color: 'var(--wiki-text-secondary)' }}
          >
            Click <strong>[edit]</strong> on a section to see claims related to that specific part of the article.
          </p>

          {/* Section overview */}
          <div className="space-y-1">
            {Object.entries(claimCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([sid, count]) => (
                <div
                  key={sid}
                  className="text-xs py-2 px-2 flex justify-between rounded"
                  style={{
                    background: '#f8f9fa',
                    border: '1px solid var(--wiki-chrome-border)',
                  }}
                >
                  <span>{sectionTitles[sid] || sid}</span>
                  <span
                    className="px-1.5 py-0.5 rounded"
                    style={{ background: '#eef2ff', color: '#4338ca', fontSize: '0.7rem' }}
                  >
                    {count} {count === 1 ? 'claim' : 'claims'}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </aside>
  );
}
