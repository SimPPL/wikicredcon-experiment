'use client';

import { useState } from 'react';

interface InstructionStepperProps {
  articleTitle: string;
  condition: 'treatment' | 'control';
  isMedical: boolean;
  isControversial: boolean;
  onComplete: () => void;
}

interface Step {
  title: string;
  accent: string;
  background: string;
  body: React.ReactNode;
}

/**
 * Shows task instructions one card at a time before editing begins.
 * The editing timer does not start until the participant clicks
 * "Start editing" on the final step.
 */
export default function InstructionStepper({
  articleTitle,
  condition,
  isMedical,
  isControversial,
  onComplete,
}: InstructionStepperProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const steps: Step[] = [
    {
      title: 'This is a simulated Wikipedia',
      accent: '#60a5fa',
      background: '#eff6ff',
      body: (
        <>
          <p style={{ marginBottom: '0.75rem' }}>
            The page you are about to see looks and works like Wikipedia&apos;s editor,
            but it is a <strong>simulation built for this study</strong>. You are{' '}
            <strong>not</strong> editing the real Wikipedia article — nothing you write
            will be published to Wikipedia.
          </p>
          <p>
            Your edits are recorded anonymously so we can study how editors improve
            articles. At the end you&apos;ll see a personal dashboard of your editing
            patterns.
          </p>
        </>
      ),
    },
    {
      title: 'Your task',
      accent: '#86efac',
      background: '#f0fdf4',
      body: (
        <>
          <p style={{ marginBottom: '0.75rem' }}>
            You are editing <strong>&ldquo;{articleTitle}&rdquo;</strong>. Improve it for{' '}
            <strong>clarity</strong>, <strong>accuracy</strong>, and{' '}
            <strong>reliability</strong>, and add any new information you believe belongs
            in the article.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>You only need to edit one or two sections.</strong> Given the time
            limit, a single well-sourced improvement to one section is a perfectly good
            result. Sections you can edit are marked with an{' '}
            <span style={{ color: '#3366cc' }}>[edit]</span> link.
          </p>
          <p>
            You may consult any sources you like — news articles, academic papers,
            government databases, your own knowledge.
          </p>
        </>
      ),
    },
    {
      title: 'Your time',
      accent: '#fcd34d',
      background: '#fffbeb',
      body: (
        <>
          <p style={{ marginBottom: '0.75rem' }}>
            You have <strong>10 minutes</strong>: about 8 minutes to edit, and the last 2
            minutes to finalize and polish before submitting.
          </p>
          <p>
            The timer starts when you click <strong>Start editing</strong> on the next
            screen — not yet. When it reaches zero, your edits are submitted
            automatically, so publish when you&apos;re happy rather than waiting for the
            clock.
          </p>
        </>
      ),
    },
    {
      title: 'Ground rules',
      accent: '#fca5a5',
      background: '#fef2f2',
      body: (
        <>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>One restriction:</strong> do not visit the current Wikipedia page for
            this article — it would bias the results. Every other source is fine.
          </p>
          <p style={{ marginBottom: '0.5rem' }}>Wikipedia&apos;s core policies apply:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Neutral point of view</strong> — represent significant viewpoints
              proportionately.
            </li>
            <li>
              <strong>Verifiability</strong> — cite reliable, published sources for
              claims likely to be challenged.
            </li>
            <li>
              <strong>No original research</strong> — summarize sources rather than
              adding your own analysis.
            </li>
          </ul>
          {isMedical && (
            <p style={{ marginTop: '0.75rem' }}>
              <strong>Medical content:</strong> biomedical claims need high-quality
              sources (review articles, major textbooks, recognized health
              organizations).
            </p>
          )}
          {isControversial && (
            <p style={{ marginTop: '0.75rem' }}>
              <strong>Contentious topic:</strong> this subject is frequently contested —
              take extra care with sourcing and neutrality.
            </p>
          )}
        </>
      ),
    },
  ];

  if (condition === 'treatment') {
    steps.push({
      title: 'The claims panel',
      accent: '#c4b5fd',
      background: '#f5f3ff',
      body: (
        <>
          <p style={{ marginBottom: '0.75rem' }}>
            A sidebar will show <strong>claims from social media</strong> related to
            sections of this article, grouped by topic.
          </p>
          <p>
            These claims are shown because they are prominent, <strong>not</strong>{' '}
            because they are accurate. Use your judgment — they may point you to gaps in
            the article, or they may be wrong.
          </p>
        </>
      ),
    });
  }

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(32, 33, 34, 0.55)' }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Task instructions"
      >
        <div
          className="p-6 rounded-t-lg"
          style={{ background: step.background, borderBottom: `3px solid ${step.accent}` }}
        >
          <div
            className="text-xs font-semibold tracking-wide mb-1"
            style={{ color: 'var(--wiki-text-secondary)', fontFamily: 'sans-serif' }}
          >
            BEFORE YOU START &middot; {stepIndex + 1} of {steps.length}
          </div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: 'var(--wiki-text)' }}
          >
            {step.title}
          </h2>
        </div>

        <div
          className="p-6 text-sm"
          style={{ color: 'var(--wiki-text)', lineHeight: 1.6, minHeight: 170 }}
        >
          {step.body}
        </div>

        <div className="flex items-center justify-between px-6 pb-6">
          <button
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="px-4 py-2 text-sm rounded cursor-pointer disabled:opacity-0 disabled:cursor-default"
            style={{
              color: 'var(--wiki-link)',
              background: 'transparent',
              border: '1px solid var(--wiki-chrome-border)',
            }}
          >
            Back
          </button>

          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className="inline-block rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  background: i === stepIndex ? '#3366cc' : '#c8ccd1',
                }}
              />
            ))}
          </div>

          <button
            onClick={() => (isLast ? onComplete() : setStepIndex((i) => i + 1))}
            className="px-5 py-2 text-sm font-semibold text-white rounded cursor-pointer"
            style={{ backgroundColor: '#3366cc' }}
            autoFocus
          >
            {isLast ? 'Start editing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
