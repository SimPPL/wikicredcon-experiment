'use client';

import { useState } from 'react';
import type { ClaimMark, SelfServeClaim } from '@/lib/selfserve';

// Wikipedia-minimal claims sidebar (wireframe editbetter-claimrail-minimal-2026-10-19):
// the claim as a quotation, who posted it and when, and its sources as plain links.
// No labels, verdicts or engagement counts: the editor judges the sources.

const longDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

const domain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

const linkStyle = { color: 'var(--wiki-link)' };
const actionClass = 'cursor-pointer hover:underline';

function ClaimRow({
  claim,
  mark,
  onMark,
}: {
  claim: SelfServeClaim;
  mark?: ClaimMark;
  onMark: (state: ClaimMark['state'] | null) => void;
}) {
  const used = mark?.state === 'used';
  const dismissed = mark?.state === 'not-relevant';

  return (
    <li
      data-testid={`claim-${claim.id}`}
      className="py-3 border-b"
      style={{ borderColor: 'var(--wiki-chrome-border)', opacity: dismissed ? 0.5 : 1 }}
    >
      <p className="text-sm" style={{ lineHeight: 1.45, color: 'var(--wiki-text)' }}>
        &ldquo;{claim.text}&rdquo;
      </p>

      <p className="text-xs mt-1" style={{ color: 'var(--wiki-text-secondary)' }}>
        {claim.author}, {longDate(claim.postDate)} ·{' '}
        <a href={claim.postUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          {claim.platform === 'youtube' ? 'video' : 'post on X'} ↗
        </a>
      </p>

      <p className="text-xs mt-1" style={{ color: 'var(--wiki-text-secondary)' }} data-testid="claim-sources">
        {claim.sourceUrls.length === 0 ? (
          'No sources given'
        ) : (
          <>
            Sources:{' '}
            {claim.sourceUrls.map((u, i) => (
              <span key={u}>
                {i > 0 && ', '}
                <a href={u} target="_blank" rel="noopener noreferrer" style={linkStyle} title={u}>
                  {domain(u)}
                </a>
              </span>
            ))}
          </>
        )}
      </p>

      <p className="text-xs mt-1" style={{ color: 'var(--wiki-text-secondary)' }}>
        {dismissed ? (
          <>
            not relevant ·{' '}
            <button onClick={() => onMark(null)} className={actionClass} style={linkStyle}>undo</button>
          </>
        ) : used ? (
          <>
            <span style={{ color: 'var(--wiki-success)' }}>used in my edit ✓</span> ·{' '}
            <button onClick={() => onMark(null)} className={actionClass} style={linkStyle}>undo</button>
          </>
        ) : (
          <>
            <button onClick={() => onMark('used')} className={actionClass} style={linkStyle}>used in my edit</button>
            {' · '}
            <button onClick={() => onMark('not-relevant')} className={actionClass} style={linkStyle}>not relevant</button>
          </>
        )}
      </p>
    </li>
  );
}

export default function ClaimRail({
  claims,
  activeSectionId,
  activeSectionTitle,
  marks,
  onMark,
}: {
  claims: SelfServeClaim[];
  activeSectionId: string | null;
  activeSectionTitle: string;
  marks: Record<string, ClaimMark>;
  onMark: (claimId: string, state: ClaimMark['state'] | null) => void;
}) {
  const [scope, setScope] = useState<'section' | 'all'>('section');
  // Oldest first: a neutral order, no ranking by engagement.
  const shown = claims
    .filter((c) => scope === 'all' || c.sectionId === activeSectionId)
    .sort((a, b) => (a.postDate ?? '').localeCompare(b.postDate ?? ''));

  const scopeLink = (s: 'section' | 'all', text: string) =>
    scope === s ? (
      <span className="font-semibold">{text}</span>
    ) : (
      <button onClick={() => setScope(s)} className={actionClass} style={linkStyle}>{text}</button>
    );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
        <h2 className="text-sm font-semibold" data-testid="rail-heading">
          {scope === 'section'
            ? `Posts on X and YouTube about ${activeSectionTitle} (${shown.length})`
            : `All posts on X and YouTube (${claims.length})`}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--wiki-text-secondary)' }}>
          {scopeLink('section', 'this section')} · {scopeLink('all', 'all')}
        </p>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto px-4" data-testid="claim-list">
        {shown.length === 0 && (
          <li className="text-sm py-3" style={{ color: 'var(--wiki-text-secondary)' }}>
            No posts about this section.{' '}
            <button onClick={() => setScope('all')} className={actionClass} style={linkStyle}>See all.</button>
          </li>
        )}
        {shown.map((c) => (
          <ClaimRow key={c.id} claim={c} mark={marks[c.id]} onMark={(state) => onMark(c.id, state)} />
        ))}
      </ul>
    </div>
  );
}
