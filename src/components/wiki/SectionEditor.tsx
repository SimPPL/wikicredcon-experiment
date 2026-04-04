'use client';

import { ArticleSection } from '@/types';

interface SectionEditorProps {
  section: ArticleSection;
  isEditing: boolean;
  onToggleEdit: (sectionId: string) => void;
  onContentChange: (sectionId: string, newContent: string) => void;
  editedContent?: string;
  onFocus?: (sectionId: string) => void;
  onBlur?: (sectionId: string) => void;
}

function renderContentWithCitations(content: string, citations: ArticleSection['citations']) {
  // Split into paragraphs on double newlines
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

  return (
    <div>
      {paragraphs.map((para, pIdx) => {
        if (citations.length === 0) {
          return <p key={pIdx} style={{ marginBottom: '0.5em' }}>{para}</p>;
        }

        // Replace [n] patterns with superscript citation links
        const parts: React.ReactNode[] = [];
        const regex = /\[(\d+)\]/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(para)) !== null) {
          if (match.index > lastIndex) {
            parts.push(para.slice(lastIndex, match.index));
          }
          const citationIndex = parseInt(match[1], 10);
          parts.push(
            <sup key={`cite-${pIdx}-${match.index}`} className="wiki-citation">
              [{citationIndex}]
            </sup>
          );
          lastIndex = regex.lastIndex;
        }

        if (lastIndex < para.length) {
          parts.push(para.slice(lastIndex));
        }

        return <p key={pIdx} style={{ marginBottom: '0.5em' }}>{parts}</p>;
      })}
    </div>
  );
}

export default function SectionEditor({
  section,
  isEditing,
  onToggleEdit,
  onContentChange,
  editedContent,
  onFocus,
  onBlur,
}: SectionEditorProps) {
  const HeadingTag = section.level <= 2 ? 'h2' : 'h3';

  const heading = section.level === 1 ? (
    <h1>
      {section.title}
      <span
        className="wiki-edit-link"
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onToggleEdit(section.id); }}
        onKeyDown={(e) => { if (e.key === 'Enter') onToggleEdit(section.id); }}
      >
        [edit]
      </span>
    </h1>
  ) : (
    <HeadingTag>
      {section.title}
      <span
        className="wiki-edit-link"
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onToggleEdit(section.id); }}
        onKeyDown={(e) => { if (e.key === 'Enter') onToggleEdit(section.id); }}
      >
        {isEditing ? '[close]' : '[edit]'}
      </span>
    </HeadingTag>
  );

  if (isEditing) {
    const value = editedContent !== undefined ? editedContent : section.content;
    return (
      <div className="mb-4" style={{ border: '1px solid var(--wiki-link)', borderRadius: 2, padding: '0.5rem' }}>
        {heading}
        <textarea
          className="wiki-editor-textarea"
          value={value}
          onChange={(e) => onContentChange(section.id, e.target.value)}
          onFocus={() => onFocus?.(section.id)}
          onBlur={() => onBlur?.(section.id)}
          rows={Math.max(6, value.split('\n').length + 2)}
          autoFocus
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={() => onToggleEdit(section.id)}
            className="text-xs px-3 py-1 rounded cursor-pointer"
            style={{ color: 'var(--wiki-link)', border: '1px solid var(--wiki-chrome-border)' }}
          >
            Done editing section
          </button>
        </div>
      </div>
    );
  }

  const displayContent = editedContent !== undefined ? editedContent : section.content;

  return (
    <div className="mb-4">
      {heading}
      {renderContentWithCitations(displayContent, section.citations)}
    </div>
  );
}
