'use client';

import { useState, useMemo } from 'react';
import type { ClaimGroup, ClaimSource } from '@/types';

interface ClaimsSidebarProps {
  claimGroups: ClaimGroup[];
  activeSectionId?: string | null;
  sectionTitles?: Record<string, string>;
  onClaimView?: (claimId: string) => void;
  onClaimClick?: (claimId: string) => void;
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

function SourceLink({ source }: { source: ClaimSource }) {
  const icons: Record<string, string> = {
    'fact-check': '\u2713',
    'news': '\ud83d\udcf0',
    'wikipedia': 'W',
    'academic': '\ud83d\udcc4',
    'other': '\ud83d\udd17',
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

type TabId = 'claims' | 'sources' | 'fact-checks';

export default function ClaimsSidebar({
  claimGroups,
  activeSectionId,
  sectionTitles = {},
  onClaimView,
  onClaimClick,
  collapsed,
  onToggle,
}: ClaimsSidebarProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('claims');

  const totalClaims = useMemo(
    () => claimGroups.reduce((sum, g) => sum + g.claimCount, 0),
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

  // --- Collapsed state ---
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 px-2 py-4 text-xs font-semibold rounded-l cursor-pointer"
        style={{
          background: '#36c',
          color: '#fff',
          writingMode: 'vertical-rl',
        }}
      >
        Claims ({totalClaims})
      </button>
    );
  }

  // --- Group detail view ---
  if (selectedGroup) {
    const sources = selectedGroup.sources || [];
    const factChecks = selectedGroup.factChecks || [];

    return (
      <aside
        className="arbiter-sidebar h-screen overflow-hidden flex flex-col p-4 sticky top-0"
        style={{ width: 370, flexShrink: 0 }}
      >
        {/* Header with collapse */}
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
            }}
          >
            Collapse
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
            { id: 'sources' as TabId, label: 'Sources', count: sources.length },
            { id: 'fact-checks' as TabId, label: 'Fact-checks', count: factChecks.length },
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
                sources.map((src, i) => <SourceLink key={`src-${i}`} source={src} />)
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
                factChecks.map((fc, i) => <SourceLink key={`fc-${i}`} source={fc} />)
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
        </div>
      </aside>
    );
  }

  // --- Default / group list view ---
  return (
    <aside
      className="arbiter-sidebar h-screen overflow-y-auto p-4 sticky top-0"
      style={{ width: 370, flexShrink: 0 }}
    >
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
          }}
        >
          Collapse
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
        {sortedGroups.map((group) => {
          const isRelevant = activeSectionId
            ? group.relevantSectionIds.includes(activeSectionId)
            : false;

          return (
            <button
              key={group.groupId}
              onClick={() => { setSelectedGroupId(group.groupId); setActiveTab('claims'); }}
              className="w-full text-left rounded p-3 cursor-pointer"
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
    </aside>
  );
}
