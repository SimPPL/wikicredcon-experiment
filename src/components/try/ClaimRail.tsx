'use client';

import { useState } from 'react';
import type { ClaimMark, SelfServeClaim } from '@/lib/selfserve';

const LABELS: Record<SelfServeClaim['label'], { text: string; bg: string; fg: string; hint: string }> = {
  gap: { text: 'Gap', bg: '#fef6e7', fg: '#8a5300', hint: 'The article said nothing about this at the start of June.' },
  contradicts: { text: 'Contradicts', bg: '#fee7e6', fg: '#a3221b', hint: 'The article said something different at the start of June.' },
  covered: { text: 'Covered', bg: '#e8f3ee', fg: '#14684a', hint: 'The article already said this at the start of June.' },
};

const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);

const shortDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';

const platformName = (p: string) => (p === 'twitter' ? 'X' : p === 'youtube' ? 'YouTube' : p);

function ClaimCard({
  claim,
  mark,
  onMark,
  onCite,
}: {
  claim: SelfServeClaim;
  mark?: ClaimMark;
  onMark: (state: ClaimMark['state'] | null) => void;
  onCite: () => void;
}) {
  const [open, setOpen] = useState(false);
  const label = LABELS[claim.label];
  const used = mark?.state === 'used';
  const dismissed = mark?.state === 'not-relevant';

  return (
    <li
      data-testid={`claim-${claim.id}`}
      className="rounded p-3"
      style={{
        background: 'var(--wiki-bg)',
        border: `1px solid ${used ? 'var(--wiki-success)' : 'var(--wiki-chrome-border)'}`,
        opacity: dismissed ? 0.55 : 1,
      }}
    >
      <div className="flex items-start gap-2">
        <span
          title={label.hint}
          className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{ background: label.bg, color: label.fg }}
        >
          {label.text}
        </span>
        <p className="text-sm" style={{ lineHeight: 1.4 }}>{claim.text}</p>
      </div>

      <p className="text-xs mt-2" style={{ color: 'var(--wiki-text-secondary)' }}>
        @{claim.author} · {platformName(claim.platform)}
        {claim.postDate ? ` · ${shortDate(claim.postDate)}` : ''} · {compact(claim.interactions)} interactions ·{' '}
        <a href={claim.postUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wiki-link)' }}>
          post ↗
        </a>
      </p>

      {open && (
        <div className="text-xs mt-2 space-y-1" style={{ color: 'var(--wiki-text-secondary)' }}>
          <p><strong>Why it is here:</strong> {claim.why}</p>
          <p><strong>Arbiter&apos;s check:</strong> {claim.verification}</p>
          {claim.sourceUrls.map((u) => (
            <p key={u} className="truncate">
              <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wiki-link)' }}>{u.replace(/^https?:\/\/(www\.)?/, '')}</a>
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => onMark(used ? null : 'used')}
          className="text-xs px-2 py-1 rounded cursor-pointer"
          style={{
            border: '1px solid var(--wiki-chrome-border)',
            background: used ? 'var(--wiki-success)' : 'transparent',
            color: used ? '#fff' : 'var(--wiki-text)',
          }}
        >
          {used ? 'Used ✓' : 'Used this'}
        </button>
        {claim.sourceUrls.length > 0 && (
          <button
            onClick={onCite}
            className="text-xs px-2 py-1 rounded cursor-pointer"
            style={{ border: '1px solid var(--wiki-chrome-border)', color: 'var(--wiki-link)' }}
          >
            Cite its source
          </button>
        )}
        <button
          onClick={() => onMark(dismissed ? null : 'not-relevant')}
          className="text-xs px-2 py-1 rounded cursor-pointer"
          style={{ color: 'var(--wiki-text-secondary)' }}
        >
          {dismissed ? 'Undo' : 'Not relevant'}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs px-2 py-1 rounded cursor-pointer ml-auto"
          style={{ color: 'var(--wiki-link)' }}
        >
          {open ? 'Less' : 'Why + sources'}
        </button>
      </div>
    </li>
  );
}

export default function ClaimRail({
  claims,
  activeSectionId,
  activeSectionTitle,
  marks,
  onMark,
  onCite,
}: {
  claims: SelfServeClaim[];
  activeSectionId: string | null;
  activeSectionTitle: string;
  marks: Record<string, ClaimMark>;
  onMark: (claimId: string, state: ClaimMark['state'] | null) => void;
  onCite: (claim: SelfServeClaim) => void;
}) {
  const [scope, setScope] = useState<'section' | 'all'>('section');
  const order = { contradicts: 0, gap: 1, covered: 2 } as const;
  const shown = claims
    .filter((c) => scope === 'all' || c.sectionId === activeSectionId)
    .sort((a, b) => order[a.label] - order[b.label] || b.interactions - a.interactions);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
        <h2 className="text-sm font-semibold truncate" data-testid="rail-heading">
          {scope === 'section' ? `${activeSectionTitle} · ${shown.length} claim${shown.length === 1 ? '' : 's'}` : `All ${claims.length} claims`}
        </h2>
        <div className="ml-auto flex text-xs rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--wiki-chrome-border)' }}>
          {(['section', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className="px-2 py-1 cursor-pointer"
              style={{ background: scope === s ? 'var(--wiki-link)' : 'transparent', color: scope === s ? '#fff' : 'var(--wiki-text)' }}
            >
              {s === 'section' ? 'This section' : 'All'}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3" data-testid="claim-list">
        {shown.length === 0 && (
          <li className="text-sm" style={{ color: 'var(--wiki-text-secondary)' }}>
            Nobody we collected made a claim about this section. Switch to All to see the rest, or edit it anyway.
          </li>
        )}
        {shown.map((c) => (
          <ClaimCard
            key={c.id}
            claim={c}
            mark={marks[c.id]}
            onMark={(state) => onMark(c.id, state)}
            onCite={() => onCite(c)}
          />
        ))}
      </ul>
    </div>
  );
}
