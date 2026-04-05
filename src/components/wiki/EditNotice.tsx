'use client';

interface EditNoticeProps {
  articleId: string;
  articleTitle: string;
  revisionDate: string;
}

export default function EditNotice({ articleId, articleTitle, revisionDate }: EditNoticeProps) {
  const isMedical = ['semaglutide', 'glp1-receptor-agonist', 'ultra-processed-food', 'microplastics'].includes(articleId);
  const isControversial = ['vaccine-misinfo', 'misinformation', 'deepfake'].includes(articleId);

  return (
    <div className="space-y-3 mb-4">
      {/* Task instructions — what the editor should do */}
      <div
        className="p-4 text-sm rounded"
        style={{
          background: '#f0fdf4',
          border: '2px solid #86efac',
          color: 'var(--wiki-text)',
        }}
      >
        <div className="font-bold mb-2" style={{ fontFamily: 'sans-serif', fontSize: '0.95rem' }}>
          Your task
        </div>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
          You are editing a snapshot of <strong>&ldquo;{articleTitle}&rdquo;</strong> from{' '}
          <strong>{revisionDate}</strong>. Edit this article for <strong>clarity</strong>,{' '}
          <strong>accuracy</strong>, <strong>reliability</strong>, and any{' '}
          <strong>new information</strong> you believe should be included.
        </p>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
          You have <strong>10 minutes</strong> to edit, plus <strong>1 minute</strong> to
          finalize and polish your changes before submission.
        </p>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
          You may use <strong>any sources</strong> you prefer — news articles, academic papers,
          government databases, your own knowledge — to inform your edits.
        </p>
      </div>

      {/* Restriction: cannot visit current Wikipedia article */}
      <div
        className="p-3 text-sm rounded"
        style={{
          background: '#fef2f2',
          border: '2px solid #fca5a5',
          color: 'var(--wiki-text)',
        }}
      >
        <div className="font-bold mb-1" style={{ fontFamily: 'sans-serif' }}>
          Important restriction
        </div>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
          You <strong>cannot</strong> visit the current Wikipedia page for this article.
          This is the only resource you may not consult, as it would bias the experimental
          outcome. All other sources — search engines, news sites, academic databases,
          social media — are permitted.
        </p>
      </div>

      {/* Editing guidelines */}
      <div
        className="p-3 text-sm rounded"
        style={{
          background: '#eaf3ff',
          border: '1px solid #a3c1e0',
          color: 'var(--wiki-text)',
        }}
      >
        <div className="font-semibold mb-1" style={{ fontFamily: 'sans-serif' }}>
          Wikipedia editing guidelines
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
            Medical content notice
          </div>
          <p style={{ fontSize: '0.85rem' }}>
            This article contains biomedical content. Biomedical claims require high-quality
            sources such as review articles, major textbooks, or statements from recognized
            health organizations. Primary research studies should be used cautiously.
          </p>
        </div>
      )}

      {/* Controversial topic notice */}
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
            This article covers a frequently contested topic. Take particular care to ensure
            all additions are well-sourced, written from a neutral point of view, and give
            appropriate weight to different perspectives.
          </p>
        </div>
      )}
    </div>
  );
}
