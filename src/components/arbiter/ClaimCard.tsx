'use client';

import { ArbiterClaim, Platform } from '@/types';

interface ClaimCardProps {
  claim: ArbiterClaim;
  isRelevant?: boolean;
  onView?: (claimId: string) => void;
  onClick?: (claimId: string) => void;
}

const platformConfig: Record<Platform, { emoji: string; label: string; color: string }> = {
  twitter: { emoji: '🐦', label: 'Twitter', color: '#1da1f2' },
  reddit: { emoji: '📱', label: 'Reddit', color: '#ff4500' },
  youtube: { emoji: '▶️', label: 'YouTube', color: '#ff0000' },
  bluesky: { emoji: '🦋', label: 'Bluesky', color: '#0085ff' },
};

function formatCount(n: number | undefined): string {
  if (n === undefined) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export default function ClaimCard({ claim, isRelevant, onView, onClick }: ClaimCardProps) {
  const platform = platformConfig[claim.platform];

  return (
    <div
      className="p-3 mb-2 rounded cursor-pointer transition-colors"
      style={{
        borderLeft: `4px solid ${platform.color}`,
        background: isRelevant ? '#eef3ff' : '#fff',
        border: `1px solid var(--wiki-chrome-border)`,
        borderLeftWidth: 4,
        borderLeftColor: platform.color,
      }}
      onClick={() => {
        onClick?.(claim.id);
        onView?.(claim.id);
      }}
    >
      {/* Platform & date header */}
      <div className="flex items-center justify-between mb-1 text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
        <span>
          {platform.emoji} {platform.label}
        </span>
        <span>{claim.date}</span>
      </div>

      {/* Claim text */}
      <p className="text-sm mb-2 leading-snug" style={{ color: 'var(--wiki-text)' }}>
        {claim.claimText}
      </p>

      {/* Engagement metrics */}
      <div className="flex gap-3 text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
        {claim.engagement.likes !== undefined && (
          <span>♥ {formatCount(claim.engagement.likes)}</span>
        )}
        {claim.engagement.shares !== undefined && (
          <span>↗ {formatCount(claim.engagement.shares)}</span>
        )}
        {claim.engagement.comments !== undefined && (
          <span>💬 {formatCount(claim.engagement.comments)}</span>
        )}
        {claim.engagement.views !== undefined && (
          <span>👁 {formatCount(claim.engagement.views)}</span>
        )}
      </div>

      {/* Source link */}
      {claim.sourceUrl && (
        <div className="mt-1.5 text-xs">
          <a
            href={claim.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--wiki-link)', textDecoration: 'underline' }}
          >
            View source on {platform.label}
          </a>
        </div>
      )}

      {/* Not fact-checked indicator */}
      <div className="mt-1 text-xs italic" style={{ color: '#a2a9b1' }}>
        Not fact-checked — social media claim
      </div>
    </div>
  );
}
