'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { EXPERIMENT } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';
import type { ParticipantData, Article } from '@/types';
import AnalysisPanel from '@/components/dashboard/AnalysisPanel';
import QABenchmarkPanel from '@/components/dashboard/QABenchmarkPanel';

// ── Statistical helpers ────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function pairedTTest(treatment: number[], control: number[]) {
  const n = Math.min(treatment.length, control.length);
  if (n < 2) return { tStatistic: 0, pValue: 1, meanDiff: 0, cohensD: 0 };

  const diffs = treatment.slice(0, n).map((t, i) => t - control[i]);
  const meanDiff = mean(diffs);
  const sdDiff = sd(diffs);
  if (sdDiff === 0) return { tStatistic: 0, pValue: 1, meanDiff, cohensD: 0 };

  const tStat = meanDiff / (sdDiff / Math.sqrt(n));
  const cohensD = meanDiff / sdDiff;
  // Rough p-value approximation
  const pValue = Math.min(1, 2 * Math.exp(-0.717 * Math.abs(tStat) - 0.416 * tStat * tStat));

  return { tStatistic: tStat, pValue, meanDiff, cohensD };
}

// ── Article IDs ────────────────────────────────────────────

const ALL_ARTICLE_IDS = [
  'semaglutide',
  'vaccine-misinfo',
  'ultra-processed-food',
  'glp1-receptor-agonist',
  'pfas',
  'deepfake',
  'agi',
  'cultivated-meat',
  'openai',
  'misinformation',
  'microplastics',
  'right-to-repair',
] as const;

const SELECTED_ARTICLES_KEY = 'wikicred_selected_articles';

// ── Article stats type ─────────────────────────────────────

interface ArticleStats {
  id: string;
  title: string;
  pastDate: string;
  currentDate: string;
  pastSections: number;
  currentSections: number;
  pastCitations: number;
  currentCitations: number;
  growthPercent: number;
  newCitations: number;
  loaded: boolean;
  error?: string;
}

// ── Shared styles ──────────────────────────────────────────

const serif = "Georgia, 'Linux Libertine', serif";

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #c8ccd1',
  borderRadius: '4px',
};

// ── Component ──────────────────────────────────────────────

export default function AdminPage() {
  // Auth state — session-only, no localStorage
  const [authenticated, setAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Data state
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'articles' | 'participants' | 'analysis' | 'benchmark'>('articles');

  // Article state
  const [articleStats, setArticleStats] = useState<ArticleStats[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [articlesLoading, setArticlesLoading] = useState(false);

  // ── Login handler ──────────────────────────────────────

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      loginUsername === EXPERIMENT.ADMIN_USERNAME &&
      loginPassword === EXPERIMENT.ADMIN_PASSWORD
    ) {
      setAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid username or password.');
    }
  };

  // ── Load participants from localStorage ────────────────

  const loadAllParticipants = useCallback(() => {
    const all: ParticipantData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('wikicred_participant_data_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!);
          all.push(data);
        } catch {
          // skip invalid entries
        }
      }
    }
    setParticipants(all);
  }, []);

  // ── Load article stats ────────────────────────────────

  const loadArticleStats = useCallback(async () => {
    setArticlesLoading(true);
    const results: ArticleStats[] = [];

    for (const id of ALL_ARTICLE_IDS) {
      try {
        const [pastRes, currentRes] = await Promise.all([
          fetch(`/data/articles/${id}-past.json`),
          fetch(`/data/articles/${id}-current.json`),
        ]);

        if (!pastRes.ok || !currentRes.ok) {
          results.push({
            id,
            title: id,
            pastDate: '',
            currentDate: '',
            pastSections: 0,
            currentSections: 0,
            pastCitations: 0,
            currentCitations: 0,
            growthPercent: 0,
            newCitations: 0,
            loaded: false,
            error: 'Failed to fetch',
          });
          continue;
        }

        const past: Article = await pastRes.json();
        const current: Article = await currentRes.json();

        const pastCitations = past.sections.reduce((sum, s) => sum + s.citations.length, 0);
        const currentCitations = current.sections.reduce((sum, s) => sum + s.citations.length, 0);

        const pastContentLength = past.sections.reduce((sum, s) => sum + s.content.length, 0);
        const currentContentLength = current.sections.reduce((sum, s) => sum + s.content.length, 0);

        const growthPercent =
          pastContentLength > 0
            ? ((currentContentLength - pastContentLength) / pastContentLength) * 100
            : 0;

        results.push({
          id,
          title: current.title || id,
          pastDate: past.revisionDate,
          currentDate: current.revisionDate,
          pastSections: past.sections.length,
          currentSections: current.sections.length,
          pastCitations,
          currentCitations,
          growthPercent,
          newCitations: currentCitations - pastCitations,
          loaded: true,
        });
      } catch {
        results.push({
          id,
          title: id,
          pastDate: '',
          currentDate: '',
          pastSections: 0,
          currentSections: 0,
          pastCitations: 0,
          currentCitations: 0,
          growthPercent: 0,
          newCitations: 0,
          loaded: false,
          error: 'Fetch error',
        });
      }
    }

    setArticleStats(results);
    setArticlesLoading(false);
  }, []);

  // ── Init after authentication ─────────────────────────

  useEffect(() => {
    if (!authenticated) return;
    loadAllParticipants();
    loadArticleStats();

    // Restore selected articles from localStorage
    try {
      const stored = localStorage.getItem(SELECTED_ARTICLES_KEY);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        setSelectedArticles(new Set(ids));
      }
    } catch {
      // ignore
    }
  }, [authenticated, loadAllParticipants, loadArticleStats]);

  // ── Toggle article selection ──────────────────────────

  const toggleArticle = (id: string) => {
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem(SELECTED_ARTICLES_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const selectAllArticles = () => {
    const all = new Set(ALL_ARTICLE_IDS as unknown as string[]);
    setSelectedArticles(all);
    localStorage.setItem(SELECTED_ARTICLES_KEY, JSON.stringify(Array.from(all)));
  };

  const deselectAllArticles = () => {
    setSelectedArticles(new Set());
    localStorage.setItem(SELECTED_ARTICLES_KEY, JSON.stringify([]));
  };

  // ── Import / Export ───────────────────────────────────

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        try {
          const text = await file.text();
          const data: ParticipantData = JSON.parse(text);
          localStorage.setItem(`wikicred_participant_data_${data.participant.id}`, text);
        } catch (err) {
          console.error('Failed to import file:', file.name, err);
        }
      }
      loadAllParticipants();
    },
    [loadAllParticipants],
  );

  const handleExportCSV = useCallback(() => {
    if (participants.length === 0) return;

    const headers = [
      'participant_id',
      'email',
      'wiki_username',
      'assigned_order',
      'years_active',
      'edit_count',
      'session_1_condition',
      'session_1_article',
      'session_1_duration_ms',
      'session_1_citations',
      'session_1_edit_events',
      'session_1_tab_blurs',
      'session_1_arbiter_interactions',
      'session_2_condition',
      'session_2_article',
      'session_2_duration_ms',
      'session_2_citations',
      'session_2_edit_events',
      'session_2_tab_blurs',
      'session_2_arbiter_interactions',
      'survey_usefulness_post',
      'survey_confidence_post',
      'survey_would_use_tool',
      'survey_showed_new_info',
      'survey_changed_editing',
    ];

    const rows = participants.map((p) => {
      const s1 = p.sessions[0];
      const s2 = p.sessions[1];
      return [
        p.participant.id,
        `"${p.participant.email}"`,
        p.participant.wikiUsername || '',
        p.participant.assignedOrder,
        p.participant.experience.yearsActive,
        p.participant.experience.approxEditCount,
        s1?.condition || '',
        s1?.articleId || '',
        s1?.totalEditTime || '',
        s1?.citationsAdded.length || 0,
        s1?.editEvents.length || 0,
        s1?.tabBlurEvents.length || 0,
        s1?.arbiterInteractions.length || 0,
        s2?.condition || '',
        s2?.articleId || '',
        s2?.totalEditTime || '',
        s2?.citationsAdded.length || 0,
        s2?.editEvents.length || 0,
        s2?.tabBlurEvents.length || 0,
        s2?.arbiterInteractions.length || 0,
        p.survey?.socialMediaUsefulnessPost || '',
        p.survey?.confidencePost || '',
        p.survey?.wouldUseTool || '',
        p.survey?.arbiterShowedNewInfo ? 'yes' : 'no',
        p.survey?.arbiterChangedEditing ? 'yes' : 'no',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wikicred-experiment-all-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [participants]);

  // ── Statistical analysis (only when data exists) ──────

  const stats = useMemo(() => {
    const completed = participants.filter((p) => p.sessions.length === 2);
    if (completed.length === 0) return null;

    const treatmentCitations: number[] = [];
    const controlCitations: number[] = [];
    const treatmentEditEvents: number[] = [];
    const controlEditEvents: number[] = [];
    const treatmentDuration: number[] = [];
    const controlDuration: number[] = [];
    const treatmentTabBlurs: number[] = [];
    const controlTabBlurs: number[] = [];

    completed.forEach((p) => {
      p.sessions.forEach((s) => {
        const isTreatment = s.condition === 'treatment';
        (isTreatment ? treatmentCitations : controlCitations).push(s.citationsAdded.length);
        (isTreatment ? treatmentEditEvents : controlEditEvents).push(s.editEvents.length);
        (isTreatment ? treatmentDuration : controlDuration).push(s.totalEditTime);
        (isTreatment ? treatmentTabBlurs : controlTabBlurs).push(s.tabBlurEvents.length);
      });
    });

    return {
      n: completed.length,
      citations: {
        treatment: { mean: mean(treatmentCitations), sd: sd(treatmentCitations) },
        control: { mean: mean(controlCitations), sd: sd(controlCitations) },
        test: pairedTTest(treatmentCitations, controlCitations),
      },
      editEvents: {
        treatment: { mean: mean(treatmentEditEvents), sd: sd(treatmentEditEvents) },
        control: { mean: mean(controlEditEvents), sd: sd(controlEditEvents) },
        test: pairedTTest(treatmentEditEvents, controlEditEvents),
      },
      duration: {
        treatment: { mean: mean(treatmentDuration), sd: sd(treatmentDuration) },
        control: { mean: mean(controlDuration), sd: sd(controlDuration) },
        test: pairedTTest(treatmentDuration, controlDuration),
      },
      tabBlurs: {
        treatment: { mean: mean(treatmentTabBlurs), sd: sd(treatmentTabBlurs) },
        control: { mean: mean(controlTabBlurs), sd: sd(controlTabBlurs) },
        test: pairedTTest(treatmentTabBlurs, controlTabBlurs),
      },
    };
  }, [participants]);

  // ── Login screen ──────────────────────────────────────

  if (!authenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#f8f9fa' }}
      >
        <div style={{ ...cardStyle, padding: '2rem', width: '100%', maxWidth: '380px' }}>
          <h1
            style={{
              fontFamily: serif,
              fontSize: '1.5rem',
              marginBottom: '0.25rem',
              color: '#202122',
            }}
          >
            Admin Sign In
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#54595d', marginBottom: '1.5rem' }}>
            WikiCredCon Editing Experiment
          </p>

          <form onSubmit={handleLogin}>
            <label
              style={{ display: 'block', fontSize: '0.85rem', color: '#202122', marginBottom: '0.25rem' }}
            >
              Username
            </label>
            <input
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              autoFocus
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem 0.6rem',
                border: '1px solid #c8ccd1',
                borderRadius: '2px',
                fontSize: '0.9rem',
                marginBottom: '0.75rem',
                boxSizing: 'border-box',
              }}
            />

            <label
              style={{ display: 'block', fontSize: '0.85rem', color: '#202122', marginBottom: '0.25rem' }}
            >
              Password
            </label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem 0.6rem',
                border: '1px solid #c8ccd1',
                borderRadius: '2px',
                fontSize: '0.9rem',
                marginBottom: '1rem',
                boxSizing: 'border-box',
              }}
            />

            {loginError && (
              <p style={{ color: '#d33', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {loginError}
              </p>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.55rem',
                backgroundColor: '#3366cc',
                color: '#fff',
                border: 'none',
                borderRadius: '2px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Authenticated dashboard ───────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      {/* Header */}
      <div
        style={{
          background: '#eaecf0',
          borderBottom: '1px solid #c8ccd1',
          padding: '1rem 1.5rem',
        }}
      >
        <h1 style={{ fontFamily: serif, fontSize: '1.5rem', color: '#202122', margin: 0 }}>
          Admin Dashboard
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#54595d', marginTop: '0.2rem' }}>
          WikiCredCon Editing Experiment — Manage articles, participants, and results
        </p>
      </div>

      {/* Tab navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          borderBottom: '1px solid #c8ccd1',
          background: '#fff',
          paddingLeft: '1.5rem',
        }}
      >
        {([
          ['articles', 'Articles'],
          ['participants', 'Participants'],
          ['analysis', 'Analysis'],
          ['benchmark', 'QA Benchmark'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.9rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === key ? '3px solid #3366cc' : '3px solid transparent',
              color: activeTab === key ? '#3366cc' : '#54595d',
              fontWeight: activeTab === key ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
        {/* ── Action bar ─────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <label
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: '#3366cc',
              color: '#fff',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Import JSON
            <input
              type="file"
              accept=".json"
              multiple
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <button
            onClick={handleExportCSV}
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: '#14866d',
              color: '#fff',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Export CSV
          </button>
          <button
            onClick={loadAllParticipants}
            style={{
              padding: '0.45rem 1rem',
              border: '1px solid #c8ccd1',
              background: '#fff',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Refresh
          </button>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/data/dummy-experiment/dummy-localstorage.json');
                if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                const data: Record<string, unknown> = await res.json();
                for (const [key, value] of Object.entries(data)) {
                  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                }
                window.location.reload();
              } catch (err) {
                console.error('Failed to load dummy data:', err);
                alert('Failed to load dummy data. Check the console for details.');
              }
            }}
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Generate Dummy Data
          </button>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/persist');
                if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                const rows = await res.json();
                if (Array.isArray(rows)) {
                  for (const row of rows) {
                    if (row.participant_id && row.data) {
                      localStorage.setItem(
                        `wikicred_participant_data_${row.participant_id}`,
                        typeof row.data === 'string' ? row.data : JSON.stringify(row.data)
                      );
                    }
                  }
                  alert(`Synced ${rows.length} participants from server.`);
                  window.location.reload();
                }
              } catch (err) {
                console.error('Sync failed:', err);
                alert('Sync failed. Check console for details.');
              }
            }}
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: '#0891b2',
              color: '#fff',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Sync from Server
          </button>
        </div>

        {/* ── Overview cards ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ ...cardStyle, padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#202122' }}>
              {participants.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#54595d' }}>Total participants</div>
          </div>
          <div style={{ ...cardStyle, padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#202122' }}>
              {participants.filter((p) => p.sessions.length === 2).length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#54595d' }}>Completed both tasks</div>
          </div>
          <div style={{ ...cardStyle, padding: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#202122' }}>
              {participants.filter((p) => p.survey).length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#54595d' }}>Completed survey</div>
          </div>
        </div>

        {/* ── ARTICLES TAB ───────────────────────────────── */}
        {activeTab === 'articles' && (
          <div style={{ ...cardStyle, padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: serif, fontSize: '1.25rem', color: '#202122', margin: 0 }}>
                Article Corpus ({selectedArticles.size} of {ALL_ARTICLE_IDS.length} selected)
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={selectAllArticles}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.8rem',
                    border: '1px solid #c8ccd1',
                    background: '#fff',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                >
                  Select all
                </button>
                <button
                  onClick={deselectAllArticles}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.8rem',
                    border: '1px solid #c8ccd1',
                    background: '#fff',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                >
                  Deselect all
                </button>
              </div>
            </div>

            {articlesLoading ? (
              <p style={{ color: '#54595d', fontSize: '0.9rem' }}>Loading article data...</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #c8ccd1' }}>
                      <th style={{ textAlign: 'center', padding: '0.5rem 0.5rem', width: '40px' }}></th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Article</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Past date</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Current date</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Growth</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Past citations</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Current citations</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>New citations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articleStats.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => toggleArticle(a.id)}
                        style={{
                          borderBottom: '1px solid #eaecf0',
                          cursor: 'pointer',
                          background: selectedArticles.has(a.id) ? '#f0f4ff' : 'transparent',
                          opacity: a.loaded ? 1 : 0.5,
                        }}
                      >
                        <td style={{ textAlign: 'center', padding: '0.5rem 0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={selectedArticles.has(a.id)}
                            onChange={() => toggleArticle(a.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>
                          {a.title}
                          {a.error && (
                            <span style={{ color: '#d33', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                              ({a.error})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#54595d' }}>{a.pastDate}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#54595d' }}>{a.currentDate}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: '0.5rem 0.75rem',
                            color: a.growthPercent > 0 ? '#14866d' : a.growthPercent < 0 ? '#d33' : '#54595d',
                            fontWeight: 500,
                          }}
                        >
                          {a.loaded ? `${a.growthPercent > 0 ? '+' : ''}${a.growthPercent.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>
                          {a.loaded ? a.pastCitations : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>
                          {a.loaded ? a.currentCitations : '—'}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: '0.5rem 0.75rem',
                            color: a.newCitations > 0 ? '#14866d' : '#54595d',
                            fontWeight: 500,
                          }}
                        >
                          {a.loaded ? (a.newCitations > 0 ? `+${a.newCitations}` : a.newCitations) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── PARTICIPANTS TAB ───────────────────────────── */}
        {activeTab === 'participants' && (
          <div style={{ ...cardStyle, padding: '1.5rem' }}>
            <h2 style={{ fontFamily: serif, fontSize: '1.25rem', color: '#202122', marginBottom: '1rem' }}>
              All Participants
            </h2>

            {participants.length === 0 ? (
              <p style={{ color: '#54595d', fontSize: '0.9rem' }}>
                No participant data found. Import JSON files or wait for participants to complete sessions.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #c8ccd1' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Wiki username</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Order</th>
                      <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Sessions</th>
                      <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Survey</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Dashboard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <>
                        <tr
                          key={p.participant.id}
                          onClick={() =>
                            setExpandedId(expandedId === p.participant.id ? null : p.participant.id)
                          }
                          style={{
                            borderBottom: expandedId === p.participant.id ? 'none' : '1px solid #eaecf0',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: '0.5rem 0.75rem' }}>{p.participant.email}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#54595d' }}>
                            {p.participant.wikiUsername || '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{p.participant.assignedOrder}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                background: p.sessions.length === 2 ? '#d5fdd5' : '#fff3cd',
                                color: p.sessions.length === 2 ? '#14866d' : '#856404',
                              }}
                            >
                              {p.sessions.length}/2
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>
                            {p.survey ? 'Yes' : 'No'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>
                            <a
                              href={`/dashboard/${p.participant.id}`}
                              style={{ color: '#3366cc', textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              View
                            </a>
                          </td>
                        </tr>
                        {expandedId === p.participant.id && (
                          <tr key={`${p.participant.id}-detail`} style={{ borderBottom: '1px solid #eaecf0' }}>
                            <td colSpan={6} style={{ padding: '0.75rem', background: '#f8f9fa' }}>
                              <div style={{ fontSize: '0.82rem', lineHeight: '1.6' }}>
                                <strong>ID:</strong> {p.participant.id}
                                <br />
                                <strong>Experience:</strong> {p.participant.experience.yearsActive},{' '}
                                {p.participant.experience.approxEditCount} edits
                                <br />
                                <strong>Content areas:</strong>{' '}
                                {p.participant.experience.contentAreas.join(', ') || 'None specified'}
                                {p.sessions.map((s, idx) => (
                                  <div
                                    key={s.sessionId}
                                    style={{
                                      marginTop: '0.5rem',
                                      padding: '0.5rem',
                                      background: '#fff',
                                      border: '1px solid #eaecf0',
                                      borderRadius: '2px',
                                    }}
                                  >
                                    <strong>Session {idx + 1}</strong> — {s.condition} on{' '}
                                    <em>{s.articleId}</em>
                                    <br />
                                    Duration: {formatDuration(s.totalEditTime)} | Citations:{' '}
                                    {s.citationsAdded.length} | Edits: {s.editEvents.length} | Tab
                                    switches: {s.tabBlurEvents.length}
                                    {s.condition === 'treatment' && (
                                      <>
                                        {' '}
                                        | Claims panel interactions: {s.arbiterInteractions.length}
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYSIS TAB ───────────────────────────────── */}
        {activeTab === 'analysis' && (
          <AnalysisPanel participants={participants} />
        )}

        {activeTab === 'benchmark' && (
          <QABenchmarkPanel participants={participants} />
        )}
      </div>
    </div>
  );
}
