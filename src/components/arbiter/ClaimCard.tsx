'use client';

import { useState } from 'react';
import { ArbiterClaim, Platform, ClaimSource } from '@/types';

interface ClaimCardProps {
  claim: ArbiterClaim;
  isRelevant?: boolean;
  onView?: (claimId: string) => void;
  onClick?: (claimId: string) => void;
  currentArticleId?: string; // to filter out wikipedia links to the current article
}

const platformConfig: Record<Platform, { emoji: string; label: string; color: string }> = {
  twitter: { emoji: '𝕏', label: 'X (Twitter)', color: '#1da1f2' },
  reddit: { emoji: '🔴', label: 'Reddit', color: '#ff4500' },
  youtube: { emoji: '▶️', label: 'YouTube', color: '#ff0000' },
  bluesky: { emoji: '🦋', label: 'Bluesky', color: '#0085ff' },
};

function formatCount(n: number | undefined): string {
  if (n === undefined || n === 0) return '';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function SourceLink({ source, type }: { source: ClaimSource; type: string }) {
  const icons: Record<string, string> = {
    'fact-check': '✓',
    'news': '📰',
    'wikipedia': 'W',
    'academic': '📄',
    'other': '🔗',
  };
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block py-1.5 px-2 rounded text-xs hover:bg-gray-100"
      style={{ color: 'var(--wiki-text)', textDecoration: 'none', borderBottom: '1px solid #f0f0f0' }}
    >
      <div className="flex items-start gap-1.5">
        <span style={{ fontSize: '0.7rem', flexShrink: 0 }}>{icons[source.type] || icons.other}</span>
        <div className="min-w-0">
          <div className="font-medium" style={{ color: 'var(--wiki-link)', fontSize: '0.75rem' }}>
            {source.title?.slice(0, 80) || source.url.slice(0, 60)}
          </div>
          {source.publisher && (
            <div style={{ color: 'var(--wiki-text-secondary)', fontSize: '0.7rem' }}>
              {source.publisher}
            </div>
          )}
          {source.snippet && (
            <div style={{ color: 'var(--wiki-text-disabled)', fontSize: '0.7rem', marginTop: 2 }}>
              {source.snippet.slice(0, 120)}...
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

export default function ClaimCard({ claim, isRelevant, onView, onClick, currentArticleId }: ClaimCardProps) {
  const [expanded, setExpanded] = useState(false);
  const platform = platformConfig[claim.platform] || platformConfig.twitter;

  const totalEngagement = claim.engagement.total ||
    (claim.engagement.likes || 0) + (claim.engagement.shares || 0) +
    (claim.engagement.comments || 0) + (claim.engagement.views || 0);

  // Filter wikipedia refs that link to the current article being edited
  const filteredWikiRefs = (claim.wikipediaRefs || []).filter(ref => {
    if (!currentArticleId) return true;
    const url = ref.url.toLowerCase();
    return !url.includes(currentArticleId.replace(/-/g, '_'));
  });

  const hasSources = (claim.sources && claim.sources.length > 0) ||
    (claim.factChecks && claim.factChecks.length > 0) ||
    (filteredWikiRefs.length > 0);

  return (
    <div
      className="mb-2.5 rounded"
      style={{
        borderLeft: `4px solid ${platform.color}`,
        background: isRelevant ? '#f8faff' : '#fff',
        border: '1px solid var(--wiki-chrome-border)',
        borderLeftWidth: 4,
        borderLeftColor: platform.color,
        overflow: 'hidden',
      }}
      onClick={() => { onClick?.(claim.id); onView?.(claim.id); }}
    >
      {/* Header */}
      <div className="p-2.5">
        <div className="flex items-center justify-between mb-1 text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
          <span className="flex items-center gap-1">
            <span>{platform.emoji}</span>
            <span className="font-medium">{claim.sourceAuthor ? `@${claim.sourceAuthor}` : platform.label}</span>
          </span>
          <span>{claim.date}</span>
        </div>

        {/* Claim text */}
        <p className="text-sm mb-1.5 leading-snug" style={{ color: 'var(--wiki-text)' }}>
          {claim.claimText}
        </p>

        {/* Post text preview (if different from claim) */}
        {claim.postText && claim.postText !== claim.claimText && (
          <p className="text-xs mb-1.5 leading-snug italic" style={{ color: 'var(--wiki-text-secondary)' }}>
            &ldquo;{claim.postText.slice(0, 200)}{claim.postText.length > 200 ? '...' : ''}&rdquo;
          </p>
        )}

        {/* Engagement + source counts */}
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
          {totalEngagement > 0 && (
            <span title="Total interactions">📊 {formatCount(totalEngagement)}</span>
          )}
          {claim.sources && claim.sources.length > 0 && (
            <span title="News sources">📰 {claim.sources.length}</span>
          )}
          {claim.factChecks && claim.factChecks.length > 0 && (
            <span title="Fact-checks" style={{ color: '#14866d' }}>✓ {claim.factChecks.length} fact-check{claim.factChecks.length > 1 ? 's' : ''}</span>
          )}
          {filteredWikiRefs.length > 0 && (
            <span title="Wikipedia references">W {filteredWikiRefs.length}</span>
          )}
        </div>

        {/* Expand/collapse for sources */}
        {hasSources && (
          <button
            className="mt-1.5 text-xs cursor-pointer"
            style={{ color: 'var(--wiki-link)', background: 'none', border: 'none', padding: 0 }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? '▼ Hide sources' : '▶ View sources & fact-checks'}
          </button>
        )}

        {/* Source link to original post */}
        {claim.sourceUrl && (
          <div className="mt-1">
            <a
              href={claim.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs"
              style={{ color: 'var(--wiki-link)' }}
              onClick={(e) => e.stopPropagation()}
            >
              View original post →
            </a>
          </div>
        )}
      </div>

      {/* Expanded sources section */}
      {expanded && hasSources && (
        <div style={{ background: '#f8f9fa', borderTop: '1px solid var(--wiki-chrome-border)' }}>
          {claim.factChecks && claim.factChecks.length > 0 && (
            <div className="px-2.5 pt-2 pb-1">
              <div className="text-xs font-semibold mb-1" style={{ color: '#14866d' }}>
                Fact-checks ({claim.factChecks.length})
              </div>
              {claim.factChecks.map((fc, i) => (
                <SourceLink key={`fc-${i}`} source={fc} type="fact-check" />
              ))}
            </div>
          )}

          {filteredWikiRefs.length > 0 && (
            <div className="px-2.5 pt-2 pb-1">
              <div className="text-xs font-semibold mb-1" style={{ color: '#36c' }}>
                Wikipedia references ({filteredWikiRefs.length})
              </div>
              {filteredWikiRefs.map((ref, i) => (
                <SourceLink key={`wiki-${i}`} source={ref} type="wikipedia" />
              ))}
            </div>
          )}

          {claim.sources && claim.sources.length > 0 && (
            <div className="px-2.5 pt-2 pb-1">
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--wiki-text-secondary)' }}>
                News & other sources ({claim.sources.length})
              </div>
              {claim.sources.slice(0, 5).map((src, i) => (
                <SourceLink key={`src-${i}`} source={src} type="news" />
              ))}
              {claim.sources.length > 5 && (
                <div className="text-xs py-1 px-2" style={{ color: 'var(--wiki-text-disabled)' }}>
                  +{claim.sources.length - 5} more sources
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
