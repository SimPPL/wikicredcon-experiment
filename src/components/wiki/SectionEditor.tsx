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
  if (citations.length === 0) {
    return <p>{content}</p>;
  }

  // Replace [n] patterns with superscript citation links
  const parts: React.ReactNode[] = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const citationIndex = parseInt(match[1], 10);
    parts.push(
      <sup key={`cite-${match.index}`} className="wiki-citation">
        [{citationIndex}]
      </sup>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <p>{parts}</p>;
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

  const heading = (
    <HeadingTag>
      {section.title}
      {!isEditing && (
        <span
          className="wiki-edit-link"
          onClick={() => onToggleEdit(section.id)}
        >
          [edit]
        </span>
      )}
    </HeadingTag>
  );

  if (isEditing) {
    const value = editedContent !== undefined ? editedContent : section.content;
    return (
      <div className="mb-4">
        {heading}
        <textarea
          className="wiki-editor-textarea"
          value={value}
          onChange={(e) => onContentChange(section.id, e.target.value)}
          onFocus={() => onFocus?.(section.id)}
          onBlur={() => onBlur?.(section.id)}
          rows={Math.max(6, value.split('\n').length + 2)}
        />
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
