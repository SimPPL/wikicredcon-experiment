'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ParticipantData, ArticleQuestion } from '@/types';

// ============================================================
// QA Benchmark Panel — Question-answer evaluation for admin dashboard
// ============================================================

// --- Types for benchmark data ---

interface BenchmarkVerdict {
  questionId: string;
  question: string;
  providedAnswer: string;
  isAnswerableFromText: boolean;
  isAnswerCorrect: boolean;
  qualityRating: number;
  clarityRating: number;
  specificityRating: number;
  nonTrivialityRating: number;
  judgeExplanation: string;
  judgeModel: string;
  generatorModel: string;
  articleVersion: string;
}

interface BenchmarkResult {
  articleId: string;
  articleVersion: string;
  judgeModel: string;
  generatorModel: string;
  totalQuestions: number;
  answerable: number;
  correct: number;
  meanQuality: number;
  meanClarity: number;
  meanSpecificity: number;
  meanNonTriviality: number;
  verdicts: BenchmarkVerdict[];
  timestamp: number;
}

type QuestionWithChange = ArticleQuestion & {
  basedOnChange?: string;
};

interface EditedQuestionResult {
  questionId: string;
  answerable: boolean;
  correct: boolean;
}

interface DummyArticleData {
  articleId: string;
  results: EditedQuestionResult[];
  generatedAt: number;
}

// --- Constants ---

const ARTICLE_IDS = [
  'semaglutide',
  'vaccine-misinfo',
  'ultra-processed-food',
  'glp1-receptor-agonist',
  'openai',
  'misinformation',
  'microplastics',
  'agi',
  'pfas',
  'right-to-repair',
];

const DUMMY_DATA_KEY = 'wikicred_qa_dummy_data';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  factual: { bg: '#d5e5ff', text: '#1a3a6b' },
  causal: { bg: '#fde8d0', text: '#7a3d00' },
  temporal: { bg: '#d5f5e3', text: '#1a5e30' },
  comparison: { bg: '#f0d5ff', text: '#4a1a6b' },
};

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  easy: { bg: '#d5fdd5', text: '#14866d' },
  medium: { bg: '#fff3cd', text: '#856404' },
  hard: { bg: '#f8d7da', text: '#842029' },
};

// --- Props ---

interface QABenchmarkPanelProps {
  participants: ParticipantData[];
}

// --- Shared styles ---

const serif = "Georgia, 'Linux Libertine', serif";

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontFamily: serif,
  fontWeight: 600,
  fontSize: 13,
  color: '#202122',
  background: '#f8f9fa',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  verticalAlign: 'middle',
  fontSize: 13,
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #c8ccd1',
  borderRadius: '4px',
};

// ============================================================
// Component
// ============================================================

export default function QABenchmarkPanel({ participants }: QABenchmarkPanelProps) {
  const [selectedArticle, setSelectedArticle] = useState<string>(ARTICLE_IDS[0]);
  const [questions, setQuestions] = useState<QuestionWithChange[]>([]);
  const [pastBenchmark, setPastBenchmark] = useState<BenchmarkResult | null>(null);
  const [currentBenchmark, setCurrentBenchmark] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [dummyData, setDummyData] = useState<Record<string, DummyArticleData>>({});

  // Load dummy data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DUMMY_DATA_KEY);
      if (stored) {
        setDummyData(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // Load data when article changes
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      setQuestions([]);
      setPastBenchmark(null);
      setCurrentBenchmark(null);

      try {
        // Fetch questions
        const qRes = await fetch(`/data/questions/${selectedArticle}.json`);
        if (!qRes.ok) {
          setError(`Questions file not found for ${selectedArticle}`);
          setLoading(false);
          return;
        }
        const qData: QuestionWithChange[] = await qRes.json();
        if (cancelled) return;
        setQuestions(qData);

        // Fetch benchmarks (these may not exist)
        const [pastRes, currentRes] = await Promise.all([
          fetch(`/data/judge-benchmarks/${selectedArticle}-past.json`).catch(() => null),
          fetch(`/data/judge-benchmarks/${selectedArticle}-current.json`).catch(() => null),
        ]);

        if (cancelled) return;

        if (pastRes && pastRes.ok) {
          setPastBenchmark(await pastRes.json());
        }
        if (currentRes && currentRes.ok) {
          setCurrentBenchmark(await currentRes.json());
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load benchmark data.');
        }
      }

      if (!cancelled) setLoading(false);
    }

    loadData();
    return () => { cancelled = true; };
  }, [selectedArticle]);

  // Build lookup maps from benchmarks
  const pastVerdictMap = useMemo(() => {
    const map: Record<string, BenchmarkVerdict> = {};
    if (pastBenchmark) {
      for (const v of pastBenchmark.verdicts) {
        map[v.questionId] = v;
      }
    }
    return map;
  }, [pastBenchmark]);

  const currentVerdictMap = useMemo(() => {
    const map: Record<string, BenchmarkVerdict> = {};
    if (currentBenchmark) {
      for (const v of currentBenchmark.verdicts) {
        map[v.questionId] = v;
      }
    }
    return map;
  }, [currentBenchmark]);

  // Edited data: from participants or dummy data
  const editedResults = useMemo(() => {
    const map: Record<string, EditedQuestionResult> = {};

    // Check participant evaluations first
    for (const pd of participants) {
      if (pd.questionEvaluations) {
        for (const evalSummary of pd.questionEvaluations) {
          if (evalSummary.articleId === selectedArticle) {
            for (const ev of evalSummary.evaluations) {
              // Average across participants — for now, just use last found
              map[ev.questionId] = {
                questionId: ev.questionId,
                answerable: ev.editedArticleAnswerable,
                correct: ev.editedArticleAccuracy >= 0.5,
              };
            }
          }
        }
      }
    }

    // Fall back to dummy data if no participant data
    if (Object.keys(map).length === 0 && dummyData[selectedArticle]) {
      for (const r of dummyData[selectedArticle].results) {
        map[r.questionId] = r;
      }
    }

    return map;
  }, [participants, selectedArticle, dummyData]);

  const hasEditedData = Object.keys(editedResults).length > 0;

  // Summary stats
  const summary = useMemo(() => {
    const total = questions.length;
    let pastAnswerable = 0;
    let pastCorrect = 0;
    let currentAnswerable = 0;
    let currentCorrect = 0;
    let editedAnswerable = 0;
    let editedCorrect = 0;

    for (const q of questions) {
      const pv = pastVerdictMap[q.id];
      const cv = currentVerdictMap[q.id];
      const ev = editedResults[q.id];

      if (pv?.isAnswerableFromText) pastAnswerable++;
      if (pv?.isAnswerCorrect) pastCorrect++;
      if (cv?.isAnswerableFromText) currentAnswerable++;
      if (cv?.isAnswerCorrect) currentCorrect++;
      if (ev?.answerable) editedAnswerable++;
      if (ev?.correct) editedCorrect++;
    }

    return {
      total,
      pastAnswerable,
      pastCorrect,
      currentAnswerable,
      currentCorrect,
      editedAnswerable,
      editedCorrect,
      gap: currentAnswerable - pastAnswerable,
      improvementNeeded: currentAnswerable - pastAnswerable,
    };
  }, [questions, pastVerdictMap, currentVerdictMap, editedResults]);

  // Category breakdown for bar chart
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, { past: number; current: number; edited: number; total: number }> = {};
    for (const q of questions) {
      if (!cats[q.category]) {
        cats[q.category] = { past: 0, current: 0, edited: 0, total: 0 };
      }
      cats[q.category].total++;
      if (pastVerdictMap[q.id]?.isAnswerableFromText) cats[q.category].past++;
      if (currentVerdictMap[q.id]?.isAnswerableFromText) cats[q.category].current++;
      if (editedResults[q.id]?.answerable) cats[q.category].edited++;
    }
    return cats;
  }, [questions, pastVerdictMap, currentVerdictMap, editedResults]);

  // Generate dummy data
  const generateDummyData = useCallback(() => {
    const results: EditedQuestionResult[] = [];
    for (const q of questions) {
      const pv = pastVerdictMap[q.id];
      const cv = currentVerdictMap[q.id];

      // Simulate: if past is answerable, edited likely still is.
      // If current is answerable but past isn't, ~60% chance edited made it answerable.
      // If neither, stays unanswerable.
      let answerable = false;
      let correct = false;

      if (pv?.isAnswerableFromText && pv?.isAnswerCorrect) {
        answerable = true;
        correct = true;
      } else if (cv?.isAnswerableFromText && !pv?.isAnswerableFromText) {
        // Gap question — editors may or may not have addressed it
        answerable = Math.random() < 0.6;
        correct = answerable && Math.random() < 0.7;
      } else if (pv?.isAnswerableFromText && !pv?.isAnswerCorrect) {
        answerable = true;
        correct = Math.random() < 0.5;
      } else {
        answerable = Math.random() < 0.2;
        correct = answerable && Math.random() < 0.3;
      }

      results.push({ questionId: q.id, answerable, correct });
    }

    const newDummy: DummyArticleData = {
      articleId: selectedArticle,
      results,
      generatedAt: Date.now(),
    };

    const updated = { ...dummyData, [selectedArticle]: newDummy };
    setDummyData(updated);
    localStorage.setItem(DUMMY_DATA_KEY, JSON.stringify(updated));
  }, [questions, pastVerdictMap, currentVerdictMap, selectedArticle, dummyData]);

  // --- Render ---

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#202122' }}>

      {/* Article selector */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontFamily: serif, fontWeight: 600, fontSize: 14 }}>
          Article:
        </label>
        <select
          value={selectedArticle}
          onChange={(e) => setSelectedArticle(e.target.value)}
          style={{
            padding: '6px 12px',
            border: '1px solid #a2a9b1',
            borderRadius: 3,
            fontSize: 14,
            background: '#fff',
            color: '#202122',
            minWidth: 200,
          }}
        >
          {ARTICLE_IDS.map((id) => (
            <option key={id} value={id}>
              {id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>

        <button
          onClick={generateDummyData}
          disabled={loading || questions.length === 0}
          style={{
            padding: '6px 14px',
            backgroundColor: '#7c4dff',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            cursor: loading || questions.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 500,
            opacity: loading || questions.length === 0 ? 0.5 : 1,
          }}
        >
          Generate Dummy Data
        </button>

        {dummyData[selectedArticle] && (
          <span style={{ fontSize: 12, color: '#72777d' }}>
            Dummy data generated {new Date(dummyData[selectedArticle].generatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Loading / error states */}
      {loading && (
        <p style={{ color: '#54595d', fontSize: 14 }}>Loading benchmark data...</p>
      )}
      {error && (
        <p style={{ color: '#d33', fontSize: 14 }}>{error}</p>
      )}

      {!loading && !error && questions.length > 0 && (
        <>
          {/* Summary bar */}
          <SummaryBar
            summary={summary}
            hasPast={!!pastBenchmark}
            hasCurrent={!!currentBenchmark}
            hasEdited={hasEditedData}
          />

          {/* Bar chart */}
          <CategoryBarChart
            breakdown={categoryBreakdown}
            hasEdited={hasEditedData}
          />

          {/* Per-question table */}
          <div style={{ ...cardStyle, padding: '1rem', marginTop: 20, overflowX: 'auto' }}>
            <h3 style={{ fontFamily: serif, fontSize: '1.1rem', margin: '0 0 12px 0', color: '#202122' }}>
              Per-Question Results
            </h3>

            {!pastBenchmark && !currentBenchmark && (
              <p style={{
                padding: '12px 16px',
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: 3,
                fontSize: 13,
                color: '#856404',
                marginBottom: 12,
              }}>
                Benchmark not yet run for this article. Only question metadata is shown.
              </p>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #a2a9b1' }}>
                  <th style={{ ...thStyle, width: 40 }}>#</th>
                  <th style={{ ...thStyle, minWidth: 250 }}>Question</th>
                  <th style={{ ...thStyle, width: 80 }}>Category</th>
                  <th style={{ ...thStyle, width: 70 }}>Difficulty</th>
                  <th style={{ ...thStyle, width: 90, textAlign: 'center' }}>Past (Oct 2025)</th>
                  <th style={{ ...thStyle, width: 90, textAlign: 'center' }}>Edited</th>
                  <th style={{ ...thStyle, width: 90, textAlign: 'center' }}>Current (Apr 2026)</th>
                  <th style={{ ...thStyle, width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, idx) => {
                  const pv = pastVerdictMap[q.id];
                  const cv = currentVerdictMap[q.id];
                  const ev = editedResults[q.id];
                  const isExpanded = expandedQuestion === q.id;

                  return (
                    <QuestionRow
                      key={q.id}
                      question={q}
                      index={idx}
                      pastVerdict={pv}
                      currentVerdict={cv}
                      editedResult={ev}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedQuestion(isExpanded ? null : q.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Footer */}
      <p style={{
        marginTop: 20,
        fontSize: 12,
        color: '#72777d',
        fontStyle: 'italic',
        lineHeight: 1.5,
      }}>
        Past = Oct 2025 Wikipedia snapshot. Current = Apr 2026 snapshot (gold standard).
        Edited = participant-edited versions (or dummy data if no participants).
        Benchmarks scored by LLM judge (model noted in benchmark files).
      </p>
    </div>
  );
}

// ============================================================
// Summary Bar
// ============================================================

function SummaryBar({
  summary,
  hasPast,
  hasCurrent,
  hasEdited,
}: {
  summary: {
    total: number;
    pastAnswerable: number;
    pastCorrect: number;
    currentAnswerable: number;
    currentCorrect: number;
    editedAnswerable: number;
    editedCorrect: number;
    gap: number;
    improvementNeeded: number;
  };
  hasPast: boolean;
  hasCurrent: boolean;
  hasEdited: boolean;
}) {
  const statCardStyle: React.CSSProperties = {
    ...cardStyle,
    padding: '12px 16px',
    flex: '1 1 0',
    minWidth: 140,
  };

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {hasPast && (
        <div style={statCardStyle}>
          <div style={{ fontSize: 11, color: '#72777d', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Past (Baseline)
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#202122' }}>
            {summary.pastAnswerable}/{summary.total}
          </div>
          <div style={{ fontSize: 12, color: '#54595d' }}>
            answerable, {summary.pastCorrect} correct
          </div>
        </div>
      )}

      {hasEdited && (
        <div style={statCardStyle}>
          <div style={{ fontSize: 11, color: '#72777d', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Edited (Participants)
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#7c4dff' }}>
            {summary.editedAnswerable}/{summary.total}
          </div>
          <div style={{ fontSize: 12, color: '#54595d' }}>
            answerable, {summary.editedCorrect} correct
          </div>
        </div>
      )}

      {hasCurrent && (
        <div style={statCardStyle}>
          <div style={{ fontSize: 11, color: '#72777d', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Current (Gold Standard)
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#14866d' }}>
            {summary.currentAnswerable}/{summary.total}
          </div>
          <div style={{ fontSize: 12, color: '#54595d' }}>
            answerable, {summary.currentCorrect} correct
          </div>
        </div>
      )}

      {hasPast && hasCurrent && (
        <div style={statCardStyle}>
          <div style={{ fontSize: 11, color: '#72777d', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Gap (Past to Current)
          </div>
          <div style={{
            fontSize: 22,
            fontWeight: 700,
            color: summary.gap > 0 ? '#14866d' : summary.gap < 0 ? '#d33' : '#54595d',
          }}>
            {summary.gap > 0 ? '+' : ''}{summary.gap}
          </div>
          <div style={{ fontSize: 12, color: '#54595d' }}>
            questions became answerable
          </div>
        </div>
      )}

      {hasPast && hasCurrent && (
        <div style={statCardStyle}>
          <div style={{ fontSize: 11, color: '#72777d', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Improvement Needed
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#d33' }}>
            {summary.total - summary.pastAnswerable}
          </div>
          <div style={{ fontSize: 12, color: '#54595d' }}>
            questions editors need to address
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Category Bar Chart (CSS-based)
// ============================================================

function CategoryBarChart({
  breakdown,
  hasEdited,
}: {
  breakdown: Record<string, { past: number; current: number; edited: number; total: number }>;
  hasEdited: boolean;
}) {
  const categories = Object.keys(breakdown);
  if (categories.length === 0) return null;

  const maxTotal = Math.max(...categories.map((c) => breakdown[c].total), 1);

  return (
    <div style={{ ...cardStyle, padding: '1rem', marginBottom: 20 }}>
      <h3 style={{ fontFamily: serif, fontSize: '1.1rem', margin: '0 0 16px 0', color: '#202122' }}>
        Answerability by Category
      </h3>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, background: '#a2a9b1', borderRadius: 2 }} />
          Past
        </span>
        {hasEdited && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#7c4dff', borderRadius: 2 }} />
            Edited
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, background: '#14866d', borderRadius: 2 }} />
          Current
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {categories.map((cat) => {
          const d = breakdown[cat];
          const barScale = (val: number) => `${(val / maxTotal) * 100}%`;

          return (
            <div key={cat}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, textTransform: 'capitalize' }}>
                {cat}
                <span style={{ color: '#72777d', fontWeight: 400, marginLeft: 6 }}>
                  ({d.total} questions)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Past bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 50, fontSize: 11, color: '#72777d', textAlign: 'right', flexShrink: 0 }}>Past</div>
                  <div style={{ flex: 1, background: '#eaecf0', borderRadius: 2, height: 16, position: 'relative' }}>
                    <div style={{
                      width: barScale(d.past),
                      height: '100%',
                      background: '#a2a9b1',
                      borderRadius: 2,
                      minWidth: d.past > 0 ? 2 : 0,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ width: 30, fontSize: 12, fontWeight: 500, flexShrink: 0 }}>{d.past}</div>
                </div>
                {/* Edited bar */}
                {hasEdited && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 50, fontSize: 11, color: '#72777d', textAlign: 'right', flexShrink: 0 }}>Edited</div>
                    <div style={{ flex: 1, background: '#eaecf0', borderRadius: 2, height: 16, position: 'relative' }}>
                      <div style={{
                        width: barScale(d.edited),
                        height: '100%',
                        background: '#7c4dff',
                        borderRadius: 2,
                        minWidth: d.edited > 0 ? 2 : 0,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ width: 30, fontSize: 12, fontWeight: 500, flexShrink: 0 }}>{d.edited}</div>
                  </div>
                )}
                {/* Current bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 50, fontSize: 11, color: '#72777d', textAlign: 'right', flexShrink: 0 }}>Current</div>
                  <div style={{ flex: 1, background: '#eaecf0', borderRadius: 2, height: 16, position: 'relative' }}>
                    <div style={{
                      width: barScale(d.current),
                      height: '100%',
                      background: '#14866d',
                      borderRadius: 2,
                      minWidth: d.current > 0 ? 2 : 0,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ width: 30, fontSize: 12, fontWeight: 500, flexShrink: 0 }}>{d.current}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Question Row (with expandable detail)
// ============================================================

function QuestionRow({
  question,
  index,
  pastVerdict,
  currentVerdict,
  editedResult,
  isExpanded,
  onToggle,
}: {
  question: QuestionWithChange;
  index: number;
  pastVerdict?: BenchmarkVerdict;
  currentVerdict?: BenchmarkVerdict;
  editedResult?: EditedQuestionResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const catColor = CATEGORY_COLORS[question.category] || { bg: '#eaecf0', text: '#202122' };
  const diffColor = DIFFICULTY_COLORS[question.difficulty] || { bg: '#eaecf0', text: '#202122' };

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: isExpanded ? 'none' : '1px solid #eaecf0',
          cursor: 'pointer',
          background: isExpanded ? '#f8f9fa' : 'transparent',
        }}
      >
        <td style={{ ...tdStyle, fontWeight: 500, color: '#54595d' }}>
          {index + 1}
        </td>
        <td style={{ ...tdStyle, maxWidth: 400 }}>
          <div style={{ lineHeight: 1.4 }}>{question.question}</div>
        </td>
        <td style={tdStyle}>
          <Badge bg={catColor.bg} text={catColor.text} label={question.category} />
        </td>
        <td style={tdStyle}>
          <Badge bg={diffColor.bg} text={diffColor.text} label={question.difficulty} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          <AnswerableCell verdict={pastVerdict} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          {editedResult ? (
            <EditedCell result={editedResult} />
          ) : (
            <span style={{ color: '#a2a9b1', fontSize: 12 }}>No data</span>
          )}
        </td>
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          <AnswerableCell verdict={currentVerdict} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'center', fontSize: 16, color: '#72777d' }}>
          {isExpanded ? '\u25B2' : '\u25BC'}
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ borderBottom: '1px solid #eaecf0' }}>
          <td colSpan={8} style={{ padding: '12px 16px', background: '#f8f9fa' }}>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontFamily: serif }}>Gold Standard Answer:</strong>
                <div style={{
                  marginTop: 4,
                  padding: '8px 12px',
                  background: '#fff',
                  border: '1px solid #eaecf0',
                  borderRadius: 3,
                  fontSize: 13,
                }}>
                  {question.answer}
                </div>
              </div>

              {question.basedOnChange && (
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontFamily: serif }}>Based on Change:</strong>{' '}
                  <span style={{ color: '#3366cc' }}>{question.basedOnChange}</span>
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontFamily: serif }}>Relevant Passage:</strong>
                <div style={{
                  marginTop: 4,
                  padding: '8px 12px',
                  background: '#fff',
                  border: '1px solid #eaecf0',
                  borderRadius: 3,
                  fontSize: 12,
                  color: '#54595d',
                  fontStyle: 'italic',
                }}>
                  {question.relevantPassage}
                </div>
              </div>

              <div style={{ marginBottom: 4 }}>
                <strong style={{ fontFamily: serif }}>Section:</strong>{' '}
                <span style={{ color: '#54595d' }}>{question.sectionId}</span>
              </div>

              {/* Judge explanations */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                {pastVerdict && (
                  <div style={{ flex: '1 1 200px', padding: '8px 12px', background: '#fff', border: '1px solid #eaecf0', borderRadius: 3 }}>
                    <div style={{ fontSize: 11, color: '#72777d', marginBottom: 4, textTransform: 'uppercase' }}>
                      Past Judge Explanation
                    </div>
                    <div style={{ fontSize: 12, color: '#54595d' }}>
                      {pastVerdict.judgeExplanation}
                    </div>
                  </div>
                )}
                {currentVerdict && (
                  <div style={{ flex: '1 1 200px', padding: '8px 12px', background: '#fff', border: '1px solid #eaecf0', borderRadius: 3 }}>
                    <div style={{ fontSize: 11, color: '#72777d', marginBottom: 4, textTransform: 'uppercase' }}>
                      Current Judge Explanation
                    </div>
                    <div style={{ fontSize: 12, color: '#54595d' }}>
                      {currentVerdict.judgeExplanation}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================
// Small sub-components
// ============================================================

function Badge({ bg, text, label }: { bg: string; text: string; label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 500,
      background: bg,
      color: text,
      textTransform: 'capitalize',
    }}>
      {label}
    </span>
  );
}

function AnswerableCell({ verdict }: { verdict?: BenchmarkVerdict }) {
  if (!verdict) {
    return <span style={{ color: '#a2a9b1', fontSize: 12 }}>--</span>;
  }

  const answerable = verdict.isAnswerableFromText;
  const correct = verdict.isAnswerCorrect;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{
        fontSize: 16,
        lineHeight: 1,
        color: answerable ? '#14866d' : '#d33',
      }}>
        {answerable ? '\u2713' : '\u2717'}
      </span>
      {answerable && (
        <span style={{
          fontSize: 10,
          color: correct ? '#14866d' : '#d33',
        }}>
          {correct ? 'correct' : 'wrong'}
        </span>
      )}
    </div>
  );
}

function EditedCell({ result }: { result: EditedQuestionResult }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{
        fontSize: 16,
        lineHeight: 1,
        color: result.answerable ? '#7c4dff' : '#d33',
      }}>
        {result.answerable ? '\u2713' : '\u2717'}
      </span>
      {result.answerable && (
        <span style={{
          fontSize: 10,
          color: result.correct ? '#14866d' : '#d33',
        }}>
          {result.correct ? 'correct' : 'wrong'}
        </span>
      )}
    </div>
  );
}
