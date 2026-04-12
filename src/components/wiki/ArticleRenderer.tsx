'use client';

import { Article, ArbiterClaim, Citation } from '@/types';
import SectionEditor from './SectionEditor';

interface ArticleRendererProps {
  article: Article;
  editedContent: Record<string, string>;
  editedCitations?: Record<string, Citation[]>;
  editingSectionId: string | null;
  onToggleEdit: (sectionId: string) => void;
  onContentChange: (sectionId: string, newContent: string) => void;
  onReferencesChange?: (sectionId: string, citations: Citation[]) => void;
  onResetSection?: (sectionId: string) => void;
  onSectionFocus?: (sectionId: string) => void;
  onSectionBlur?: (sectionId: string) => void;
  claims?: ArbiterClaim[];
  readOnly?: boolean;
}

export default function ArticleRenderer({
  article,
  editedContent,
  editedCitations,
  editingSectionId,
  onToggleEdit,
  onContentChange,
  onReferencesChange,
  onResetSection,
  onSectionFocus,
  onSectionBlur,
  claims = [],
  readOnly = false,
}: ArticleRendererProps) {
  // Count claims per section for highlighting
  const claimCountBySection: Record<string, number> = {};
  claims.forEach((c) => {
    c.relevantSectionIds.forEach((sid) => {
      claimCountBySection[sid] = (claimCountBySection[sid] || 0) + 1;
    });
  });

  return (
    <div className="wiki-article" style={{ maxWidth: 960 }}>
      <h1>{article.title}</h1>

      {article.sections.map((section) => {
        const claimCount = claimCountBySection[section.id] || 0;

        return (
          <div key={section.id} style={{ position: 'relative' }}>
            {/* Claim indicator badge on sections with claims */}
            {claimCount > 0 && !readOnly && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: section.level === 1 ? 0 : 4,
                  background: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  color: '#4338ca',
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  zIndex: 1,
                }}
                onClick={() => onToggleEdit(section.id)}
                title={`${claimCount} social media claim${claimCount > 1 ? 's' : ''} related to this section — click [edit] to see them`}
              >
                {claimCount} {claimCount === 1 ? 'claim' : 'claims'}
              </div>
            )}
            <SectionEditor
              section={section}
              isEditing={!readOnly && editingSectionId === section.id}
              onToggleEdit={readOnly ? () => {} : onToggleEdit}
              onContentChange={onContentChange}
              onReferencesChange={readOnly ? undefined : onReferencesChange}
              onResetSection={readOnly ? undefined : onResetSection}
              editedContent={editedContent[section.id]}
              editedCitations={editedCitations?.[section.id]}
              onFocus={onSectionFocus}
              onBlur={onSectionBlur}
              hideEditLink={readOnly}
            />
          </div>
        );
      })}

      {/* Full References section */}
      {(() => {
        const allCitations = article.sections.flatMap(s => s.citations);
        if (allCitations.length === 0) return null;
        return (
          <div className="mt-8 pt-4" style={{ borderTop: '1px solid var(--wiki-chrome-border)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 400, borderBottom: '1px solid var(--wiki-chrome-border)', paddingBottom: '0.15rem', marginBottom: '0.5rem' }}>
              References
            </h2>
            <ol className="pl-5 space-y-1" style={{ fontSize: '0.8rem', color: 'var(--wiki-text-secondary)', lineHeight: 1.5 }}>
              {allCitations.map((c) => (
                <li key={c.id} value={c.index}>
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--wiki-link)' }}
                    >
                      {c.text}
                    </a>
                  ) : (
                    <span>{c.text}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        );
      })()}
    </div>
  );
}
