'use client';

/**
 * Replicates the editnotice banners Wikipedia shows above the edit box.
 * Shows article-specific guidance that real Wikipedia editors see.
 */

interface EditNoticeProps {
  articleId: string;
  revisionDate: string;
}

export default function EditNotice({ articleId, revisionDate }: EditNoticeProps) {
  const isMedical = articleId === 'semaglutide' || articleId === 'glp1-receptor-agonist';
  const isControversial = articleId === 'vaccine-misinfo' || articleId === 'deepfake';

  return (
    <div className="space-y-3 mb-4">
      {/* General editing guidance — shown on all articles */}
      <div
        className="p-3 text-sm rounded"
        style={{
          background: '#eaf3ff',
          border: '1px solid #a3c1e0',
          color: 'var(--wiki-text)',
        }}
      >
        <div className="font-semibold mb-1" style={{ fontFamily: 'sans-serif' }}>
          Editing guidelines
        </div>
        <ul className="list-disc pl-5 space-y-1" style={{ fontSize: '0.85rem' }}>
          <li>
            <strong>Neutral point of view:</strong> Represent all significant viewpoints
            proportionately. Do not advocate for any position.
          </li>
          <li>
            <strong>Verifiability:</strong> All content must be attributable to reliable,
            published sources. Add inline citations for any claims likely to be challenged.
          </li>
          <li>
            <strong>No original research:</strong> Summarize what reliable sources say.
            Do not add your own analysis or interpretation.
          </li>
          <li>
            Improve the article where you can. Preserve the value others have added — fix
            problems rather than removing good-faith content.
          </li>
        </ul>
      </div>

      {/* Medical article notice */}
      {isMedical && (
        <div
          className="p-3 text-sm rounded"
          style={{
            background: '#fff8e5',
            border: '1px solid #e0c97f',
            color: 'var(--wiki-text)',
          }}
        >
          <div className="font-semibold mb-1" style={{ fontFamily: 'sans-serif' }}>
            ⚕ Medical content notice
          </div>
          <p style={{ fontSize: '0.85rem' }}>
            This article contains biomedical content that must comply with Wikipedia&apos;s{' '}
            <span style={{ color: 'var(--wiki-link)' }}>
              medical content and sourcing guidelines
            </span>
            . Biomedical claims require high-quality sources such as review articles,
            major textbooks, or statements from recognized health organizations. Primary
            research studies should be used cautiously and should not be presented as
            establishing a medical consensus.
          </p>
        </div>
      )}

      {/* Controversial / contentious topic notice */}
      {isControversial && (
        <div
          className="p-3 text-sm rounded"
          style={{
            background: '#fef0f0',
            border: '1px solid #e0a0a0',
            color: 'var(--wiki-text)',
          }}
        >
          <div className="font-semibold mb-1" style={{ fontFamily: 'sans-serif' }}>
            Contentious topic
          </div>
          <p style={{ fontSize: '0.85rem' }}>
            This article covers a topic that is frequently subject to contentious editing.
            Editors should take particular care to ensure that all additions are well-sourced,
            written from a neutral point of view, and give appropriate weight to different
            perspectives. Discuss significant changes on the talk page before making them.
          </p>
        </div>
      )}

      {/* Revision date notice */}
      <div
        className="p-2 text-xs rounded"
        style={{
          background: '#f8f9fa',
          border: '1px solid var(--wiki-chrome-border)',
          color: 'var(--wiki-text-secondary)',
        }}
      >
        You are editing a snapshot of this article from <strong>{revisionDate}</strong>.
        Your task is to improve this version using your editorial judgment and any available
        information sources.
      </div>
    </div>
  );
}
