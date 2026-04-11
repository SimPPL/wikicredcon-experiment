'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { ClaimGroup, ClaimSource } from '@/types';
import { useIsMobile } from '@/lib/useIsMobile';

interface ClaimsSidebarProps {
  claimGroups: ClaimGroup[];
  activeSectionId?: string | null;
  sectionTitles?: Record<string, string>;
  onClaimView?: (claimId: string) => void;
  onClaimClick?: (claimId: string) => void;
  onLinkEvent?: (url: string, sourceType: string, action: 'click' | 'copy') => void;
  collapsed: boolean;
  onToggle: () => void;
}

const platformEmoji: Record<string, string> = {
  'twitter': '\ud835\udd4f',
  'twitter/x': '\ud835\udd4f',
  'reddit': '\ud83d\udd34',
  'youtube': '\u25b6\ufe0f',
  'bluesky': '\ud83e\udd8b',
};

function getPlatformEmoji(platform: string): string {
  return platformEmoji[platform.toLowerCase()] || '\ud83d\udcac';
}

function formatEngagement(n: number): string {
  if (n <= 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

// --- Source reliability (combined: Lin et al. PC1 + LLM + Iffy.news) ---

// Tier 1-5: Very Low → High credibility. 0 = not rated.
type ReliabilityTier = 0 | 1 | 2 | 3 | 4 | 5;

const TIER_COLORS: Record<ReliabilityTier, { bg: string; border: string; label: string; dot: string }> = {
  0: { bg: '#f3f4f6', border: '#d1d5db', label: 'Not rated', dot: '#9ca3af' },
  1: { bg: '#fde8e8', border: '#e53e3e', label: 'Very Low credibility', dot: '#c53030' },
  2: { bg: '#fef2e8', border: '#dd6b20', label: 'Low credibility', dot: '#c05621' },
  3: { bg: '#fefce8', border: '#d69e2e', label: 'Mixed credibility', dot: '#92711e' },
  4: { bg: '#ecfdf5', border: '#38a169', label: 'Moderately High', dot: '#276749' },
  5: { bg: '#d1fae5', border: '#059669', label: 'High credibility', dot: '#065f46' },
};

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // Strip www. prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function getReliabilityTier(url: string, iffyDomains: Record<string, number>): ReliabilityTier {
  const domain = extractDomain(url);
  if (!domain) return 0;
  // Check exact domain and parent domain (e.g., news.example.com → example.com)
  if (domain in iffyDomains) return iffyDomains[domain] as ReliabilityTier;
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parent = parts.slice(-2).join('.');
    if (parent in iffyDomains) return iffyDomains[parent] as ReliabilityTier;
  }
  return 0; // Not in dataset
}

function ReliabilityDot({ tier }: { tier: ReliabilityTier }) {
  const c = TIER_COLORS[tier];
  return (
    <span
      title={c.label}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: c.dot,
        flexShrink: 0,
        marginTop: 2,
      }}
    />
  );
}

function CopyButton({ text, onCopy }: { text: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          onCopy?.();
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copy link"
      aria-label="Copy link"
      style={{
        flexShrink: 0,
        background: 'none',
        border: '1px solid var(--wiki-chrome-border)',
        borderRadius: 3,
        cursor: 'pointer',
        padding: '2px 4px',
        fontSize: '0.65rem',
        color: copied ? 'var(--wiki-success)' : 'var(--wiki-text-secondary)',
        lineHeight: 1,
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

function SourceLink({ source, iffyDomains, onLinkEvent }: { source: ClaimSource; iffyDomains: Record<string, number>; onLinkEvent?: (url: string, sourceType: string, action: 'click' | 'copy') => void }) {
  const icons: Record<string, string> = {
    'fact-check': '\u2713',
    'news': '\ud83d\udcf0',
    'wikipedia': 'W',
    'academic': '\ud83d\udcc4',
    'other': '\ud83d\udd17',
  };
  const tier = getReliabilityTier(source.url, iffyDomains);
  const colors = TIER_COLORS[tier];
  return (
    <div
      className="py-1.5 px-2 rounded text-xs"
      style={{
        borderBottom: '1px solid #f0f0f0',
        background: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
      }}
    >
      <div className="flex items-start gap-1.5">
        <span style={{ fontSize: '0.7rem', flexShrink: 0 }}>{icons[source.type] || icons.other}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <ReliabilityDot tier={tier} />
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium"
              style={{ color: 'var(--wiki-link)', fontSize: '0.75rem', textDecoration: 'none' }}
              onClick={() => onLinkEvent?.(source.url, source.type, 'click')}
            >
              {source.title?.slice(0, 80) || source.url.slice(0, 60)}
            </a>
          </div>
          {tier > 0 && (
            <div style={{ color: colors.dot, fontSize: '0.6rem', fontWeight: 600, marginTop: 1 }}>
              {colors.label}
            </div>
          )}
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
        <CopyButton text={source.url} onCopy={() => onLinkEvent?.(source.url, source.type, 'copy')} />
      </div>
    </div>
  );
}

type TabId = 'claims' | 'sources' | 'fact-checks' | 'wikipedia';

function SidebarShell({
  children,
  isMobile,
  onClose,
}: {
  children: React.ReactNode;
  isMobile: boolean;
  onClose: () => void;
}) {
  if (!isMobile) {
    return (
      <aside
        className="arbiter-sidebar h-screen overflow-hidden flex flex-col p-4 sticky top-0"
        style={{ width: 370, flexShrink: 0 }}
      >
        {children}
      </aside>
    );
  }

  return (
    <>
      <div className="mobile-claims-backdrop" onClick={onClose} />
      <div
        className="mobile-claims-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Social media claims"
      >
        <div className="mobile-claims-handle" />
        <div className="mobile-claims-content arbiter-sidebar">
          {children}
        </div>
      </div>
    </>
  );
}

export default function ClaimsSidebar({
  claimGroups,
  activeSectionId,
  sectionTitles = {},
  onClaimView,
  onClaimClick,
  onLinkEvent,
  collapsed,
  onToggle,
}: ClaimsSidebarProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('claims');
  const isMobile = useIsMobile();
  const [highlightPulse, setHighlightPulse] = useState(false);
  const [iffyDomains, setIffyDomains] = useState<Record<string, number>>({});

  // Load combined domain reliability data (Lin et al. PC1 + LLM + Iffy.news)
  useEffect(() => {
    fetch('/data/domain-reliability.json')
      .then(r => r.ok ? r.json() : {})
      .then(setIffyDomains)
      .catch(() => {});
  }, []);
  const prevSectionRef = useRef<string | null>(null);
  const firstRelevantRef = useRef<HTMLButtonElement | null>(null);

  // When the active section changes: pulse highlights, auto-scroll, and
  // if viewing a group detail that isn't relevant, jump to the most relevant group
  useEffect(() => {
    if (!activeSectionId || activeSectionId === prevSectionRef.current) {
      prevSectionRef.current = activeSectionId ?? null;
      return;
    }
    prevSectionRef.current = activeSectionId;

    const relevantGroups = claimGroups.filter(g =>
      g.relevantSectionIds.includes(activeSectionId)
    );
    if (relevantGroups.length === 0) return;

    // Start the pulse animation
    setHighlightPulse(true);
    const timer = setTimeout(() => setHighlightPulse(false), 2000);

    // If currently viewing a group detail that isn't relevant to the new section,
    // auto-switch to the most relevant group (highest engagement)
    if (selectedGroupId) {
      const currentGroupIsRelevant = relevantGroups.some(g => g.groupId === selectedGroupId);
      if (!currentGroupIsRelevant) {
        const best = relevantGroups.sort((a, b) => b.totalEngagement - a.totalEngagement)[0];
        setSelectedGroupId(best.groupId);
        setActiveTab('claims');
      }
    } else {
      // On group list view, scroll to the first relevant group
      setTimeout(() => {
        firstRelevantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }

    return () => clearTimeout(timer);
  }, [activeSectionId, claimGroups, selectedGroupId]);

  const totalClaims = useMemo(
    () => (claimGroups || []).reduce((sum, g) => sum + (g.claimCount || g.claims?.length || 0), 0),
    [claimGroups]
  );

  // Sort groups: relevant ones first when a section is active
  const sortedGroups = useMemo(() => {
    if (!activeSectionId) return claimGroups;
    return [...claimGroups].sort((a, b) => {
      const aRelevant = a.relevantSectionIds.includes(activeSectionId) ? 1 : 0;
      const bRelevant = b.relevantSectionIds.includes(activeSectionId) ? 1 : 0;
      return bRelevant - aRelevant;
    });
  }, [claimGroups, activeSectionId]);

  const selectedGroup = useMemo(
    () => claimGroups.find((g) => g.groupId === selectedGroupId) ?? null,
    [claimGroups, selectedGroupId]
  );

  // Count how many groups are relevant to the current section
  const relevantCount = activeSectionId
    ? claimGroups.filter(g => g.relevantSectionIds.includes(activeSectionId)).length
    : 0;

  // --- Collapsed state ---
  if (collapsed) {
    if (isMobile) {
      return (
        <button
          onClick={onToggle}
          className={`mobile-claims-bar ${highlightPulse && relevantCount > 0 ? 'claims-highlight-pulse' : ''}`}
        >
          <span>Claims ({totalClaims}){relevantCount > 0 ? ` · ${relevantCount} relevant` : ''}</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Tap to open</span>
        </button>
      );
    }
    return (
      <button
        onClick={onToggle}
        className={`fixed right-0 top-1/2 -translate-y-1/2 px-2 py-4 text-xs font-semibold rounded-l cursor-pointer ${highlightPulse && relevantCount > 0 ? 'claims-highlight-pulse' : ''}`}
        style={{
          background: highlightPulse && relevantCount > 0 ? '#2a4b8d' : '#36c',
          color: '#fff',
          writingMode: 'vertical-rl',
          transition: 'background 0.3s',
        }}
      >
        Claims ({totalClaims}){relevantCount > 0 ? ` · ${relevantCount}!` : ''}
      </button>
    );
  }

  // --- Group detail view ---
  if (selectedGroup) {
    const sources = selectedGroup.sources || [];
    const factChecks = selectedGroup.factChecks || [];
    const wikiRefs = (selectedGroup.wikipediaRefs || []).filter((r: ClaimSource) => {
      // Exclude the current article's Wikipedia page
      return true; // Already filtered in parse script
    });

    return (
      <SidebarShell isMobile={isMobile} onClose={onToggle}>
        {/* Header with collapse/close */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold" style={{ color: '#36c' }}>
            Social Media Claims
          </h2>
          <button
            onClick={onToggle}
            className="text-xs px-2 py-1 rounded cursor-pointer"
            style={{
              border: '1px solid var(--wiki-chrome-border)',
              color: 'var(--wiki-text-secondary)',
              fontSize: isMobile ? '1rem' : undefined,
            }}
            aria-label="Close claims panel"
          >
            {isMobile ? '✕' : 'Collapse'}
          </button>
        </div>

        {/* Back link */}
        <button
          onClick={() => { setSelectedGroupId(null); setActiveTab('claims'); }}
          className="text-xs mb-3 cursor-pointer text-left"
          style={{ color: '#36c', background: 'none', border: 'none', padding: 0 }}
        >
          &larr; Back to all groups
        </button>

        {/* Group title and summary */}
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: 'var(--wiki-text)', lineHeight: 1.3 }}
        >
          {selectedGroup.groupTitle}
        </h3>
        <p
          className="text-xs mb-3"
          style={{ color: 'var(--wiki-text-secondary)', lineHeight: 1.4 }}
        >
          {selectedGroup.groupSummary}
        </p>

        {/* Tabs */}
        <div
          className="flex mb-0"
          style={{ borderBottom: '1px solid var(--wiki-chrome-border)' }}
        >
          {([
            { id: 'claims' as TabId, label: 'Claims', count: selectedGroup.claims.length },
            { id: 'fact-checks' as TabId, label: 'Fact-checks', count: factChecks.length },
            { id: 'wikipedia' as TabId, label: 'Wikipedia', count: wikiRefs.length },
            { id: 'sources' as TabId, label: 'Sources', count: sources.length },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="text-xs px-3 py-2 cursor-pointer"
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #36c' : '2px solid transparent',
                color: activeTab === tab.id ? '#36c' : 'var(--wiki-text-secondary)',
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto mt-2">
          {activeTab === 'claims' && (
            <div className="space-y-2">
              {selectedGroup.claims.map((claim) => (
                <div
                  key={claim.id}
                  className="rounded p-2.5"
                  style={{
                    background: '#f8f9fa',
                    border: '1px solid var(--wiki-chrome-border)',
                    borderLeft: `4px solid ${
                      claim.platform.toLowerCase().includes('twitter') ? '#1da1f2'
                        : claim.platform.toLowerCase() === 'reddit' ? '#ff4500'
                        : claim.platform.toLowerCase() === 'youtube' ? '#ff0000'
                        : '#999'
                    }`,
                  }}
                  onClick={() => {
                    onClaimClick?.(claim.id);
                    onClaimView?.(claim.id);
                  }}
                >
                  {/* Author and platform */}
                  <div
                    className="flex items-center justify-between mb-1 text-xs"
                    style={{ color: 'var(--wiki-text-secondary)' }}
                  >
                    <span className="flex items-center gap-1">
                      <span>{getPlatformEmoji(claim.platform)}</span>
                      <span className="font-medium">{claim.sourceAuthor}</span>
                    </span>
                    {claim.engagement > 0 && (
                      <span title="Engagement">{formatEngagement(claim.engagement)}</span>
                    )}
                  </div>

                  {/* Claim text */}
                  <p className="text-sm mb-1.5 leading-snug" style={{ color: 'var(--wiki-text)' }}>
                    {claim.claimText}
                  </p>

                  {/* Post excerpt */}
                  {claim.postExcerpt && (
                    <p
                      className="text-xs leading-snug italic"
                      style={{ color: 'var(--wiki-text-secondary)' }}
                    >
                      &ldquo;{claim.postExcerpt.slice(0, 200)}{claim.postExcerpt.length > 200 ? '...' : ''}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sources' && (
            <div>
              {sources.length > 0 ? (
                sources.map((src, i) => <SourceLink key={`src-${i}`} source={src} iffyDomains={iffyDomains} onLinkEvent={onLinkEvent} />)
              ) : (
                <p
                  className="text-xs py-4 text-center"
                  style={{ color: 'var(--wiki-text-disabled)' }}
                >
                  No linked sources available for this group.
                </p>
              )}
            </div>
          )}

          {activeTab === 'fact-checks' && (
            <div>
              {factChecks.length > 0 ? (
                factChecks.map((fc, i) => <SourceLink key={`fc-${i}`} source={fc} iffyDomains={iffyDomains} onLinkEvent={onLinkEvent} />)
              ) : (
                <p
                  className="text-xs py-4 text-center"
                  style={{ color: 'var(--wiki-text-disabled)' }}
                >
                  No fact-checks available for this group.
                </p>
              )}
            </div>
          )}

          {activeTab === 'wikipedia' && (
            <div>
              {wikiRefs.length > 0 ? (
                <>
                  <p className="text-xs mb-2" style={{ color: 'var(--wiki-text-secondary)' }}>
                    Related Wikipedia articles that may provide useful context. Links to the article you are currently editing have been excluded.
                  </p>
                  {wikiRefs.map((ref, i) => <SourceLink key={`wiki-${i}`} source={ref} iffyDomains={iffyDomains} onLinkEvent={onLinkEvent} />)}
                </>
              ) : (
                <p
                  className="text-xs py-4 text-center"
                  style={{ color: 'var(--wiki-text-disabled)' }}
                >
                  No related Wikipedia pages found for this group.
                </p>
              )}
            </div>
          )}
        </div>
      </SidebarShell>
    );
  }

  // --- Default / group list view ---
  return (
    <SidebarShell isMobile={isMobile} onClose={onToggle}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: '#36c' }}>
          Social Media Claims
        </h2>
        <button
          onClick={onToggle}
          className="text-xs px-2 py-1 rounded cursor-pointer"
          style={{
            border: '1px solid var(--wiki-chrome-border)',
            color: 'var(--wiki-text-secondary)',
            fontSize: isMobile ? '1rem' : undefined,
          }}
          aria-label="Close claims panel"
        >
          {isMobile ? '✕' : 'Collapse'}
        </button>
      </div>

      {/* Warning */}
      <div
        className="text-xs mb-3 p-2 rounded"
        style={{ background: '#fef8e7', border: '1px solid #f0d060', color: '#7c6a20', lineHeight: 1.4 }}
      >
        These claims are sourced from social media and <strong>need not be accurate</strong>.
        They are shown because they are prominent and relate to content in this article.
      </div>

      {/* Instruction */}
      <p
        className="text-xs mb-3"
        style={{ color: 'var(--wiki-text-secondary)', lineHeight: 1.4 }}
      >
        Click on a claim group to see the claims and sources that relate to it.
      </p>

      {/* Active section indicator */}
      {activeSectionId && sectionTitles[activeSectionId] && (
        <div
          className="text-xs font-semibold mb-3 px-2 py-1 rounded"
          style={{
            background: '#eef2ff',
            color: '#4338ca',
            border: '1px solid #c7d2fe',
          }}
        >
          Editing: &ldquo;{sectionTitles[activeSectionId]}&rdquo;
        </div>
      )}

      {/* Group cards */}
      <div className="space-y-2">
        {sortedGroups.map((group, idx) => {
          const isRelevant = activeSectionId
            ? group.relevantSectionIds.includes(activeSectionId)
            : false;

          // Track the first relevant group for auto-scroll
          const isFirstRelevant = isRelevant &&
            !sortedGroups.slice(0, idx).some(g =>
              activeSectionId && g.relevantSectionIds.includes(activeSectionId)
            );

          return (
            <button
              key={group.groupId}
              ref={isFirstRelevant ? firstRelevantRef : undefined}
              onClick={() => { setSelectedGroupId(group.groupId); setActiveTab('claims'); }}
              className={`w-full text-left rounded p-3 cursor-pointer ${isRelevant && highlightPulse ? 'claims-highlight-pulse' : ''}`}
              style={{
                background: isRelevant ? '#eef2ff' : '#f8f9fa',
                border: isRelevant
                  ? '2px solid #36c'
                  : '1px solid var(--wiki-chrome-border)',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {/* Group title */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--wiki-text)', lineHeight: 1.3 }}
                >
                  {group.groupTitle}
                </span>
                {isRelevant && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: '#36c', color: '#fff', fontSize: '0.65rem' }}
                  >
                    relevant
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div
                className="flex items-center gap-3 text-xs mb-1.5"
                style={{ color: 'var(--wiki-text-secondary)' }}
              >
                <span>{group.claimCount} {group.claimCount === 1 ? 'claim' : 'claims'}</span>
                {group.totalEngagement > 0 && (
                  <span>{formatEngagement(group.totalEngagement)} interactions</span>
                )}
              </div>

              {/* Related sections */}
              <div className="flex flex-wrap gap-1">
                {group.relevantSectionIds.map((sid) => (
                  <span
                    key={sid}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: sid === activeSectionId ? '#c7d2fe' : '#e8e8e8',
                      color: sid === activeSectionId ? '#312e81' : 'var(--wiki-text-secondary)',
                      fontSize: '0.65rem',
                    }}
                  >
                    {sectionTitles[sid] || sid}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </SidebarShell>
  );
}
