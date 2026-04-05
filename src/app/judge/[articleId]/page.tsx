'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

// --------------- Types ---------------

interface JudgeVerdict {
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
  articleVersion: 'current' | 'past' | 'edited';
}

interface JudgeBenchmark {
  articleId: string;
  articleVersion: 'current' | 'past' | 'edited';
  judgeModel: string;
  generatorModel: string;
  totalQuestions: number;
  answerable: number;
  correct: number;
  meanQuality: number;
  meanClarity: number;
  meanSpecificity: number;
  meanNonTriviality: number;
  verdicts: JudgeVerdict[];
  timestamp: number;
}

// --------------- Helpers ---------------

function titleCase(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function BoolCell({ value }: { value: boolean }) {
  return (
    <td
      style={{
        backgroundColor: value ? '#d4edda' : '#f8d7da',
        color: value ? '#155724' : '#721c24',
        textAlign: 'center',
        fontWeight: 600,
        padding: '8px 12px',
        border: '1px solid var(--wiki-chrome, #c8ccd1)',
      }}
    >
      {value ? 'Yes' : 'No'}
    </td>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const colors: Record<number, { bg: string; fg: string }> = {
    1: { bg: '#f8d7da', fg: '#721c24' },
    2: { bg: '#ffeaa7', fg: '#856404' },
    3: { bg: '#fff3cd', fg: '#856404' },
    4: { bg: '#d4edda', fg: '#155724' },
    5: { bg: '#c3e6cb', fg: '#155724' },
  };
  const c = colors[rating] || colors[3];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        backgroundColor: c.bg,
        color: c.fg,
        fontWeight: 600,
        fontSize: '0.85em',
      }}
    >
      {rating}/5
    </span>
  );
}

// --------------- Summary Card ---------------

function SummaryCard({
  label,
  benchmark,
}: {
  label: string;
  benchmark: JudgeBenchmark | null;
}) {
  if (!benchmark) {
    return (
      <div
        style={{
          flex: 1,
          padding: '20px',
          border: '1px solid var(--wiki-chrome, #c8ccd1)',
          borderRadius: '4px',
          backgroundColor: '#f8f9fa',
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1em' }}>{label}</h3>
        <p style={{ color: '#72777d', margin: 0 }}>No benchmark data available.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        padding: '20px',
        border: '1px solid var(--wiki-chrome, #c8ccd1)',
        borderRadius: '4px',
        backgroundColor: '#f8f9fa',
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1em' }}>{label}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '0.85em', color: '#72777d' }}>Answerable</span>
          <div style={{ fontSize: '1.4em', fontWeight: 700 }}>
            {benchmark.answerable}/{benchmark.totalQuestions}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '0.85em', color: '#72777d' }}>Correct</span>
          <div style={{ fontSize: '1.4em', fontWeight: 700 }}>
            {benchmark.correct}/{benchmark.totalQuestions}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '0.85em', color: '#72777d' }}>Mean Quality</span>
          <div style={{ fontSize: '1.4em', fontWeight: 700 }}>{benchmark.meanQuality}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.85em', color: '#72777d' }}>Mean Clarity</span>
          <div style={{ fontSize: '1.4em', fontWeight: 700 }}>{benchmark.meanClarity}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.85em', color: '#72777d' }}>Mean Specificity</span>
          <div style={{ fontSize: '1.4em', fontWeight: 700 }}>{benchmark.meanSpecificity}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.85em', color: '#72777d' }}>Mean Non-triviality</span>
          <div style={{ fontSize: '1.4em', fontWeight: 700 }}>{benchmark.meanNonTriviality}</div>
        </div>
      </div>
    </div>
  );
}

// --------------- Page ---------------

export default function JudgeBenchmarkPage() {
  const params = useParams();
  const articleId = params.articleId as string;

  const [currentBenchmark, setCurrentBenchmark] = useState<JudgeBenchmark | null>(null);
  const [pastBenchmark, setPastBenchmark] = useState<JudgeBenchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!articleId) return;

    async function load() {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        fetch(`/data/judge-benchmarks/${articleId}-current.json`).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`/data/judge-benchmarks/${articleId}-past.json`).then((r) =>
          r.ok ? r.json() : null
        ),
      ]);

      const current = results[0].status === 'fulfilled' ? results[0].value : null;
      const past = results[1].status === 'fulfilled' ? results[1].value : null;

      if (!current && !past) {
        setError(
          `No benchmark data found for "${articleId}". Run the benchmark script first: npx tsx scripts/run-judge-benchmark.ts`
        );
      }

      setCurrentBenchmark(current);
      setPastBenchmark(past);
      setLoading(false);
    }

    load();
  }, [articleId]);

  // Build a merged list of verdicts keyed by questionId
  const mergedVerdicts = (() => {
    const map = new Map<
      string,
      { current: JudgeVerdict | null; past: JudgeVerdict | null }
    >();

    for (const v of currentBenchmark?.verdicts ?? []) {
      map.set(v.questionId, { current: v, past: null });
    }
    for (const v of pastBenchmark?.verdicts ?? []) {
      const existing = map.get(v.questionId);
      if (existing) {
        existing.past = v;
      } else {
        map.set(v.questionId, { current: null, past: v });
      }
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  })();

  const articleTitle = titleCase(articleId);

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        fontFamily:
          '"Linux Libertine", "Georgia", "Times", "Source Serif Pro", serif',
        color: '#202122',
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '1px solid #a2a9b1', paddingBottom: '12px', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '1.8em', fontWeight: 400 }}>
          LLM-as-Judge Benchmark &mdash; {articleTitle}
        </h1>
        <p style={{ margin: 0, color: '#54595d', fontSize: '0.95em' }}>
          Questions generated by GPT-4o-mini, independently verified by Claude Haiku
        </p>
      </div>

      {/* Loading / Error */}
      {loading && (
        <p style={{ color: '#54595d', fontStyle: 'italic' }}>Loading benchmark data...</p>
      )}
      {error && (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#fef6e7',
            border: '1px solid #fc3',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
            <SummaryCard label="Current Article" benchmark={currentBenchmark} />
            <SummaryCard label="Past Article" benchmark={pastBenchmark} />
          </div>

          {/* Detailed table */}
          <h2 style={{ fontSize: '1.3em', fontWeight: 400, borderBottom: '1px solid #a2a9b1', paddingBottom: '6px' }}>
            Per-Question Results
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9em',
                marginBottom: '24px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: '#eaecf0',
                    borderBottom: '2px solid #a2a9b1',
                  }}
                >
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: '200px' }}>Question</th>
                  <th style={thStyle}>Current: Answerable?</th>
                  <th style={thStyle}>Current: Correct?</th>
                  <th style={thStyle}>Past: Answerable?</th>
                  <th style={thStyle}>Past: Correct?</th>
                  <th style={thStyle}>Quality</th>
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: '200px' }}>
                    Judge Explanation
                  </th>
                </tr>
              </thead>
              <tbody>
                {mergedVerdicts.map(([qId, { current, past }], idx) => {
                  const v = current || past;
                  if (!v) return null;

                  return (
                    <tr
                      key={qId}
                      style={{
                        borderBottom: '1px solid #c8ccd1',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8f9fa',
                      }}
                    >
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={tdStyle}>{v.question}</td>
                      {current ? (
                        <>
                          <BoolCell value={current.isAnswerableFromText} />
                          <BoolCell value={current.isAnswerCorrect} />
                        </>
                      ) : (
                        <>
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#72777d' }}>
                            &mdash;
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#72777d' }}>
                            &mdash;
                          </td>
                        </>
                      )}
                      {past ? (
                        <>
                          <BoolCell value={past.isAnswerableFromText} />
                          <BoolCell value={past.isAnswerCorrect} />
                        </>
                      ) : (
                        <>
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#72777d' }}>
                            &mdash;
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#72777d' }}>
                            &mdash;
                          </td>
                        </>
                      )}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <RatingBadge rating={current?.qualityRating ?? past?.qualityRating ?? 0} />
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.85em', color: '#54595d' }}>
                        {current?.judgeExplanation ?? past?.judgeExplanation ?? ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Methodology note */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #c8ccd1',
              borderRadius: '4px',
              marginTop: '24px',
              fontSize: '0.9em',
              color: '#54595d',
              lineHeight: 1.6,
            }}
          >
            This benchmark uses an independent LLM judge (Claude Haiku, Anthropic) to verify
            question-answer pairs generated by a different model (GPT-4o-mini, OpenAI). Cross-model
            verification provides a weak but reproducible layer of quality assurance. Results should
            be interpreted alongside human review.
          </div>
        </>
      )}
    </div>
  );
}

// --------------- Shared styles ---------------

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '0.85em',
  border: '1px solid #a2a9b1',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #c8ccd1',
  verticalAlign: 'top',
};
