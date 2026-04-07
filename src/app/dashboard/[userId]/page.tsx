'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { formatDuration, formatTimestamp } from '@/lib/utils';
import type { ParticipantData, EditSession, Article } from '@/types';
import DiffView from '@/components/wiki/DiffView';

function BarChart({ data, label }: { data: Record<string, number>; label: string }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--wiki-text-secondary)' }}>
        {label}
      </h4>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2 mb-1">
          <span className="text-xs w-32 truncate" title={key}>
            {key}
          </span>
          <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: 'var(--wiki-chrome)' }}>
            <div
              className="h-full bar-chart-bar rounded"
              style={{
                width: `${(value / max) * 100}%`,
                backgroundColor: 'var(--wiki-button-primary)',
              }}
            />
          </div>
          <span className="text-xs w-16 text-right">{formatDuration(value)}</span>
        </div>
      ))}
    </div>
  );
}

function PercentageBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const isPositive = pct >= 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--wiki-text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: isPositive ? '#15803d' : '#b91c1c' }}>
          {pct}%
        </span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(Math.abs(pct), 100)}%`,
            backgroundColor: isPositive ? '#22c55e' : '#ef4444',
          }}
        />
      </div>
    </div>
  );
}

function articleDisplayName(articleId: string): string {
  if (articleId === 'semaglutide') return 'Semaglutide';
  if (articleId === 'vaccine-misinfo') return 'Vaccine Misinformation';
  return articleId;
}

export default function DashboardPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [data, setData] = useState<ParticipantData | null>(null);
  const [articles, setArticles] = useState<Record<string, Article>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to load from localStorage
    const stored = localStorage.getItem(`wikicred_participant_data_${userId}`);
    if (stored) {
      setData(JSON.parse(stored));
    }
    setLoading(false);

    // Load ground truth articles for diff comparison
    async function loadArticles() {
      try {
        const [semPast, semCurrent, vaxPast, vaxCurrent] = await Promise.all([
          fetch('/data/articles/semaglutide-past.json').then((r) => r.json()),
          fetch('/data/articles/semaglutide-current.json').then((r) => r.json()),
          fetch('/data/articles/vaccine-misinfo-past.json').then((r) => r.json()),
          fetch('/data/articles/vaccine-misinfo-current.json').then((r) => r.json()),
        ]);
        setArticles({
          'semaglutide-past': semPast,
          'semaglutide-current': semCurrent,
          'vaccine-misinfo-past': vaxPast,
          'vaccine-misinfo-current': vaxCurrent,
        });
      } catch {
        // Articles may not load if data files aren't present
      }
    }
    loadArticles();
  }, [userId]);

  const sessionStats = useMemo(() => {
    if (!data) return null;
    return data.sessions.map((session) => {
      const totalCitations = session.citationsAdded.length;
      const sectionsEdited = Object.entries(session.finalContent).filter(
        ([sectionId, content]) => {
          const pastArticle = articles[`${session.articleId}-past`];
          if (!pastArticle) return false;
          const originalSection = pastArticle.sections.find((s) => s.id === sectionId);
          return originalSection && content !== originalSection.content;
        }
      ).length;
      const totalEditEvents = session.editEvents.length;
      const totalArbiterInteractions = session.arbiterInteractions.length;
      const tabBlurs = session.tabBlurEvents.length;

      return {
        session,
        totalCitations,
        sectionsEdited,
        totalEditEvents,
        totalArbiterInteractions,
        tabBlurs,
      };
    });
  }, [data, articles]);

  // Compute the hero editing score: average improvement across sessions
  const heroScore = useMemo(() => {
    if (!data) return null;
    const sessionsWithMetrics = data.sessions.filter(
      (s) => s.computedMetrics && s.computedMetrics.improvementOverBaseline !== undefined
    );
    if (sessionsWithMetrics.length === 0) return null;
    const totalImprovement = sessionsWithMetrics.reduce(
      (sum, s) => sum + s.computedMetrics!.improvementOverBaseline,
      0
    );
    return totalImprovement / sessionsWithMetrics.length;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--wiki-text-secondary)' }}>Loading dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <h1
            className="text-2xl mb-4"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
          >
            Dashboard Not Found
          </h1>
          <p style={{ color: 'var(--wiki-text-secondary)' }}>
            No experiment data found for this participant. Make sure you are using the same
            browser where you completed the experiment.
          </p>
        </div>
      </div>
    );
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wikicred-experiment-${data.participant.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{ background: 'var(--wiki-chrome)', borderBottom: '1px solid var(--wiki-chrome-border)' }}
      >
        <h1 style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.5rem' }}>
          Your Editing Metrics
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--wiki-text-secondary)' }}>
          WikiCredCon Editing Experiment — {data.participant.email}
        </p>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-6">

        {/* ============================================================ */}
        {/* YOUR EDITING REPORT — shareable, screenshot-friendly section */}
        {/* ============================================================ */}
        <div className="mb-10">
          <h2
            className="text-center mb-3"
            style={{
              fontFamily: "Georgia, 'Linux Libertine', serif",
              fontSize: '1.6rem',
              color: '#202122',
            }}
          >
            Congratulations on Completing Your Edits!
          </h2>
          <p className="text-center text-sm mb-6" style={{ color: '#54595d', maxWidth: 600, margin: '0 auto 1.5rem' }}>
            We present a comparison of the snapshots you edited with the current Wikipedia
            articles, for you to compare how aligned your edits are with the Wikipedia
            community&apos;s edits.
          </p>

          {/* --- 1. Hero Score Card --- */}
          <div
            className="rounded-lg border text-center mb-8"
            style={{
              borderColor: '#c8ccd1',
              background: heroScore !== null
                ? heroScore >= 0
                  ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                  : 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)'
                : 'linear-gradient(135deg, #f8f9fa 0%, #eaecf0 100%)',
              padding: '2.5rem 2rem',
            }}
          >
            <div
              className="text-sm uppercase tracking-wider mb-2"
              style={{ color: '#54595d', fontWeight: 600, letterSpacing: '0.1em' }}
            >
              Your Editing Score
            </div>
            {heroScore !== null ? (
              <>
                <div
                  style={{
                    fontFamily: "Georgia, 'Linux Libertine', serif",
                    fontSize: '4rem',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: heroScore >= 0 ? '#15803d' : '#b91c1c',
                  }}
                >
                  {heroScore >= 0 ? '+' : ''}{(heroScore * 100).toFixed(1)}%
                </div>
                <div
                  className="mt-2 text-sm"
                  style={{ color: '#54595d', maxWidth: 420, margin: '0.5rem auto 0' }}
                >
                  {heroScore >= 0
                    ? 'Your edits are aligned with the changes the Wikipedia community made!'
                    : 'Your edits took a different direction from the Wikipedia community.'}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: "Georgia, 'Linux Libertine', serif",
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: '#72777d',
                  }}
                >
                  Score pending
                </div>
                <div className="mt-2 text-sm" style={{ color: '#72777d' }}>
                  Ground truth scoring will appear once your edits are published.
                </div>
              </>
            )}
          </div>

          {/* --- 2. Per-Session Comparison Cards --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {data.sessions.map((session, idx) => {
              const cm = session.computedMetrics;
              const wordsAdded = cm?.wordsAdded ?? 0;
              const citationsAdded = cm?.citationsAdded ?? session.citationsAdded.length;
              const sectionsEdited = cm?.sectionsEdited ?? 0;

              return (
                <div
                  key={session.sessionId}
                  className="bg-white rounded-lg border"
                  style={{ borderColor: '#c8ccd1' }}
                >
                  {/* Card header — reveal the snapshot date */}
                  <div
                    className="px-5 py-3 rounded-t-lg"
                    style={{
                      background: '#eaecf0',
                      borderBottom: '1px solid #c8ccd1',
                    }}
                  >
                    <div
                      className="font-semibold"
                      style={{
                        fontFamily: "Georgia, 'Linux Libertine', serif",
                        fontSize: '1.1rem',
                        color: '#202122',
                      }}
                    >
                      Session {idx + 1}: {articleDisplayName(session.articleId)}
                    </div>
                    <div className="text-xs" style={{ color: '#54595d' }}>
                      You edited a snapshot of the &ldquo;{articleDisplayName(session.articleId)}&rdquo; Wikipedia
                      article from{' '}
                      <strong>
                        {articles[`${session.articleId}-past`]?.revisionDate
                          ? new Date(articles[`${session.articleId}-past`].revisionDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                          : 'an earlier date'}
                      </strong>.
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-5 py-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-4">
                      <div>
                        <div className="text-xs" style={{ color: '#72777d' }}>Words added</div>
                        <div className="font-semibold text-lg" style={{ color: '#202122' }}>
                          {wordsAdded}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: '#72777d' }}>Citations added</div>
                        <div className="font-semibold text-lg" style={{ color: '#202122' }}>
                          {citationsAdded}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: '#72777d' }}>Sections edited</div>
                        <div className="font-semibold text-lg" style={{ color: '#202122' }}>
                          {sectionsEdited}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: '#72777d' }}>Time spent</div>
                        <div className="font-semibold text-lg" style={{ color: '#202122' }}>
                          {formatDuration(session.totalEditTime)}
                        </div>
                      </div>
                    </div>

                    {/* Ground truth similarity bar */}
                    {cm && cm.similarityToGroundTruth !== undefined && (
                      <PercentageBar
                        value={cm.similarityToGroundTruth}
                        label="Similarity to current Wikipedia"
                      />
                    )}

                    {/* Improvement over baseline */}
                    {cm && cm.improvementOverBaseline !== undefined && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs">
                          <span style={{ color: 'var(--wiki-text-secondary)' }}>
                            Improvement over baseline
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: cm.improvementOverBaseline >= 0 ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {cm.improvementOverBaseline >= 0 ? '+' : ''}
                            {(cm.improvementOverBaseline * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Citation comparison */}
                    {cm && cm.citationsInCurrent !== undefined && (
                      <div className="mt-3 p-2.5 rounded" style={{ background: '#f8f9fa', border: '1px solid var(--wiki-chrome-border)' }}>
                        <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--wiki-text-secondary)' }}>
                          Reference comparison
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <div style={{ color: '#72777d' }}>In original snapshot</div>
                          <div style={{ fontWeight: 500 }}>{cm.citationsInPast} references</div>
                          <div style={{ color: '#72777d' }}>In current Wikipedia</div>
                          <div style={{ fontWeight: 500 }}>{cm.citationsInCurrent} references</div>
                          <div style={{ color: '#72777d' }}>You added</div>
                          <div style={{ fontWeight: 500, color: cm.citationsAddedByEditor > 0 ? '#15803d' : '#72777d' }}>
                            {cm.citationsAddedByEditor > 0 ? '+' : ''}{cm.citationsAddedByEditor} new
                          </div>
                          <div style={{ color: '#72777d' }}>You removed</div>
                          <div style={{ fontWeight: 500, color: cm.citationsRemovedByEditor > 0 ? '#b91c1c' : '#72777d' }}>
                            {cm.citationsRemovedByEditor > 0 ? '-' : ''}{cm.citationsRemovedByEditor}
                          </div>
                          {cm.citationsMatchingCurrent > 0 && (
                            <>
                              <div style={{ color: '#72777d' }}>Match current article</div>
                              <div style={{ fontWeight: 600, color: '#15803d' }}>
                                {cm.citationsMatchingCurrent} references
                              </div>
                            </>
                          )}
                        </div>
                        {cm.citationRecoveryRate > 0 && (
                          <div className="mt-2">
                            <PercentageBar
                              value={cm.citationRecoveryRate}
                              label="Citation recovery rate"
                            />
                            <div className="text-xs mt-0.5" style={{ color: '#72777d' }}>
                              {Math.round(cm.citationRecoveryRate * 100)}% of the references that the Wikipedia
                              community added since your snapshot were also independently found by you.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!cm && (
                      <div className="text-xs mt-2 italic" style={{ color: '#72777d' }}>
                        Ground truth metrics not yet computed.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* --- 3. Explanation Text --- */}
          <div
            className="rounded border px-6 py-4 mb-8 text-sm leading-relaxed"
            style={{
              borderColor: '#c8ccd1',
              background: '#fff',
              color: '#54595d',
            }}
          >
            <strong>How to read your score:</strong> Your editing score measures how closely
            your edits align with the changes the Wikipedia community made since the snapshot
            you edited. A positive score means your edits moved the article in the same direction
            that the community eventually took. The comparison is based on text similarity and
            reference overlap between your edited version and the current Wikipedia article.
          </div>

          {/* --- 4. Share Your Results Card --- */}
          <div
            className="rounded-lg border-2 bg-white mx-auto"
            style={{
              borderColor: '#a2a9b1',
              maxWidth: 540,
              padding: '2rem',
            }}
          >
            <div
              className="text-center mb-4"
              style={{
                fontFamily: "Georgia, 'Linux Libertine', serif",
                fontSize: '1.2rem',
                color: '#202122',
              }}
            >
              WikiCredCon Editing Experiment
            </div>

            {/* Score */}
            <div className="text-center mb-4">
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#72777d' }}>
                Editing Score
              </div>
              <div
                style={{
                  fontFamily: "Georgia, 'Linux Libertine', serif",
                  fontSize: '2.2rem',
                  fontWeight: 700,
                  color: heroScore !== null
                    ? heroScore >= 0 ? '#15803d' : '#b91c1c'
                    : '#72777d',
                }}
              >
                {heroScore !== null
                  ? `${heroScore >= 0 ? '+' : ''}${(heroScore * 100).toFixed(1)}%`
                  : 'Pending'}
              </div>
            </div>

            {/* Per-session summary in the share card */}
            <div
              className="grid gap-3 mb-4"
              style={{
                gridTemplateColumns: data.sessions.length === 2 ? '1fr 1fr' : '1fr',
              }}
            >
              {data.sessions.map((session, idx) => {
                const cm = session.computedMetrics;
                return (
                  <div
                    key={session.sessionId}
                    className="rounded border px-3 py-3 text-center"
                    style={{ borderColor: '#eaecf0' }}
                  >
                    <div className="text-xs font-semibold mb-1" style={{ color: '#54595d' }}>
                      {articleDisplayName(session.articleId)}
                    </div>
                    <div className="text-xs" style={{ color: '#72777d' }}>
                      {cm?.wordsAdded ?? 0} words added
                    </div>
                    <div className="text-xs" style={{ color: '#72777d' }}>
                      {cm?.citationsAdded ?? session.citationsAdded.length} citations
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="text-center text-xs pt-3"
              style={{ color: '#a2a9b1', borderTop: '1px solid #eaecf0' }}
            >
              Screenshot this card to share your editing results!
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* EXISTING DASHBOARD CONTENT BELOW                             */}
        {/* ============================================================ */}

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded border" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
            <div className="text-2xl font-bold">{data.sessions.length}</div>
            <div className="text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
              Sessions completed
            </div>
          </div>
          <div className="bg-white p-4 rounded border" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
            <div className="text-2xl font-bold">
              {data.sessions.reduce((sum, s) => sum + s.citationsAdded.length, 0)}
            </div>
            <div className="text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
              Citations added
            </div>
          </div>
          <div className="bg-white p-4 rounded border" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
            <div className="text-2xl font-bold">
              {formatDuration(data.sessions.reduce((sum, s) => sum + s.totalEditTime, 0))}
            </div>
            <div className="text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
              Total edit time
            </div>
          </div>
          <div className="bg-white p-4 rounded border" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
            <div className="text-2xl font-bold">
              {data.sessions.reduce((sum, s) => sum + s.editEvents.length, 0)}
            </div>
            <div className="text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
              Edit events logged
            </div>
          </div>
        </div>

        {/* Per-session details */}
        {sessionStats?.map((stats, idx) => {
          const { session } = stats;
          const pastArticle = articles[`${session.articleId}-past`];

          return (
            <div
              key={session.sessionId}
              className="bg-white p-6 rounded border mb-6"
              style={{ borderColor: 'var(--wiki-chrome-border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.3rem' }}>
                  Task {idx + 1}: {session.articleId === 'semaglutide' ? 'Semaglutide' : 'Vaccine Misinformation'}
                </h2>
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    background: session.condition === 'treatment' ? '#eef2ff' : 'var(--wiki-chrome)',
                    color: session.condition === 'treatment' ? '#4338ca' : 'var(--wiki-text-secondary)',
                  }}
                >
                  {session.condition === 'treatment' ? 'With Claims Panel' : 'Without Claims Panel'}
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 text-sm">
                <div>
                  <span style={{ color: 'var(--wiki-text-secondary)' }}>Duration:</span>{' '}
                  {formatDuration(session.totalEditTime)}
                </div>
                <div>
                  <span style={{ color: 'var(--wiki-text-secondary)' }}>Citations:</span>{' '}
                  {stats.totalCitations}
                </div>
                <div>
                  <span style={{ color: 'var(--wiki-text-secondary)' }}>Sections edited:</span>{' '}
                  {stats.sectionsEdited}
                </div>
                <div>
                  <span style={{ color: 'var(--wiki-text-secondary)' }}>Edit events:</span>{' '}
                  {stats.totalEditEvents}
                </div>
                <div>
                  <span style={{ color: 'var(--wiki-text-secondary)' }}>Tab switches:</span>{' '}
                  {stats.tabBlurs}
                </div>
              </div>

              {/* Section time chart */}
              {Object.keys(session.sectionTimes).length > 0 && (
                <BarChart data={session.sectionTimes} label="Time spent per section" />
              )}

              {/* Diffs */}
              {pastArticle &&
                pastArticle.sections.map((section) => {
                  const edited = session.finalContent[section.id];
                  if (!edited || edited === section.content) return null;
                  return (
                    <div key={section.id} className="mb-4">
                      <DiffView
                        original={section.content}
                        modified={edited}
                        title={`Changes to: ${section.title}`}
                      />
                    </div>
                  );
                })}

              {/* Citations list */}
              {session.citationsAdded.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--wiki-text-secondary)' }}>
                    Citations added
                  </h4>
                  <ul className="text-sm space-y-1">
                    {session.citationsAdded.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span style={{ color: 'var(--wiki-text-disabled)' }}>
                          [{i + 1}]
                        </span>
                        <span>{c.referenceText}</span>
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--wiki-link)' }}
                          >
                            link
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Arbiter interactions (treatment only) */}
              {session.condition === 'treatment' && session.arbiterInteractions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--wiki-text-secondary)' }}>
                    Claims panel interactions: {session.arbiterInteractions.length}
                  </h4>
                </div>
              )}
            </div>
          );
        })}

        {/* Export button */}
        <div className="text-center mt-8 mb-12">
          <button
            onClick={handleExport}
            className="px-6 py-2 text-white rounded cursor-pointer text-sm"
            style={{ backgroundColor: 'var(--wiki-button-primary)' }}
          >
            Export My Data (JSON)
          </button>
          <p className="text-xs mt-2 mb-4" style={{ color: 'var(--wiki-text-disabled)' }}>
            Download your experiment data to share with the workshop facilitator.
          </p>
          <a
            href="/"
            className="px-6 py-2 rounded cursor-pointer text-sm inline-block"
            style={{ backgroundColor: 'var(--wiki-chrome)', color: 'var(--wiki-text)', border: '1px solid var(--wiki-chrome-border)' }}
          >
            Return to Home Page
          </a>
        </div>
      </div>
    </div>
  );
}
