'use client';

import { Article } from '@/types';
import SectionEditor from './SectionEditor';

interface ArticleRendererProps {
  article: Article;
  editedContent: Record<string, string>;
  editingSectionId: string | null;
  onToggleEdit: (sectionId: string) => void;
  onContentChange: (sectionId: string, newContent: string) => void;
  onSectionFocus?: (sectionId: string) => void;
  onSectionBlur?: (sectionId: string) => void;
}

export default function ArticleRenderer({
  article,
  editedContent,
  editingSectionId,
  onToggleEdit,
  onContentChange,
  onSectionFocus,
  onSectionBlur,
}: ArticleRendererProps) {
  return (
    <div className="wiki-article" style={{ maxWidth: 960 }}>
      <h1>{article.title}</h1>

      {article.sections.map((section) => (
        <SectionEditor
          key={section.id}
          section={section}
          isEditing={editingSectionId === section.id}
          onToggleEdit={onToggleEdit}
          onContentChange={onContentChange}
          editedContent={editedContent[section.id]}
          onFocus={onSectionFocus}
          onBlur={onSectionBlur}
        />
      ))}
    </div>
  );
}
