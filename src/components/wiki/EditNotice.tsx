'use client';

import { useState } from 'react';

interface EditNoticeProps {
  articleId: string;
  articleTitle: string;
  revisionDate: string;
}

export const MEDICAL_ARTICLES = ['semaglutide', 'glp1-receptor-agonist', 'ultra-processed-food', 'microplastics'];
export const CONTROVERSIAL_ARTICLES = ['vaccine-misinfo', 'misinformation', 'deepfake'];

/**
 * Compact reminder shown while editing. The full instructions are presented
 * one step at a time in InstructionStepper before the task begins — this box
 * only summarizes them, and expands on demand.
 */
export default function EditNotice({ articleId, articleTitle }: EditNoticeProps) {
  const [expanded, setExpanded] = useState(false);
  const isMedical = MEDICAL_ARTICLES.includes(articleId);
  const isControversial = CONTROVERSIAL_ARTICLES.includes(articleId);

  return (
    <div
      className="mb-4 text-sm rounded"
      style={{
        background: '#f0fdf4',
        border: '1px solid #86efac',
        color: 'var(--wiki-text)',
      }}
    >
      <div className="p-3 flex items-start justify-between gap-3">
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
          <strong>Simulated editor</strong> — nothing is published to Wikipedia. Improve{' '}
          <strong>&ldquo;{articleTitle}&rdquo;</strong> for accuracy and sourcing.{' '}
          <strong>Editing one or two sections is enough.</strong>{' '}
          Don&apos;t consult the live Wikipedia article.
        </p>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs whitespace-nowrap cursor-pointer flex-shrink-0"
          style={{ color: 'var(--wiki-link)', background: 'none', border: 'none', padding: '2px 0' }}
        >
          {expanded ? 'Hide details' : 'Full instructions'}
        </button>
      </div>

      {expanded && (
        <div
          className="px-3 pb-3 space-y-2"
          style={{ fontSize: '0.85rem', lineHeight: 1.6, borderTop: '1px solid #d1fae5', paddingTop: '0.75rem' }}
        >
          <p>
            This is a simulated editing environment for research. Your changes will not
            appear on Wikipedia; they are recorded anonymously for this study.
          </p>
          <p>
            Edit for <strong>clarity</strong>, <strong>accuracy</strong>,{' '}
            <strong>reliability</strong>, and any <strong>new information</strong> you
            believe should be included. You have 8 minutes to edit plus 2 minutes to
            finalize. Sections marked <span style={{ color: '#3366cc' }}>[edit]</span> are
            editable, and one or two well-sourced section edits is a complete task.
          </p>
          <p>
            You may use any sources <em>except</em> the current Wikipedia page for this
            article, which would bias the results.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Neutral point of view:</strong> represent significant viewpoints proportionately.</li>
            <li><strong>Verifiability:</strong> cite reliable, published sources for claims likely to be challenged.</li>
            <li><strong>No original research:</strong> summarize what sources say; don&apos;t add your own analysis.</li>
          </ul>
          {isMedical && (
            <p>
              <strong>Medical content:</strong> biomedical claims require high-quality
              sources such as review articles, major textbooks, or recognized health
              organizations.
            </p>
          )}
          {isControversial && (
            <p>
              <strong>Contentious topic:</strong> take particular care that additions are
              well-sourced, neutral, and give appropriate weight to different
              perspectives.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
