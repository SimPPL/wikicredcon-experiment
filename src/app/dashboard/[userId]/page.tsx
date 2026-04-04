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
                  {session.condition === 'treatment' ? 'With Arbiter' : 'Without Arbiter'}
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
                    Arbiter claim interactions: {session.arbiterInteractions.length}
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
          <p className="text-xs mt-2" style={{ color: 'var(--wiki-text-disabled)' }}>
            Download your experiment data to share with the workshop facilitator.
          </p>
        </div>
      </div>
    </div>
  );
}
