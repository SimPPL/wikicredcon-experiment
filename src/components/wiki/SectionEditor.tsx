'use client';

import { useState } from 'react';
import { ArticleSection, Citation } from '@/types';

interface SectionEditorProps {
  section: ArticleSection;
  isEditing: boolean;
  onToggleEdit: (sectionId: string) => void;
  onContentChange: (sectionId: string, newContent: string) => void;
  onReferencesChange?: (sectionId: string, citations: Citation[]) => void;
  editedContent?: string;
  editedCitations?: Citation[];
  onFocus?: (sectionId: string) => void;
  onBlur?: (sectionId: string) => void;
  hideEditLink?: boolean;
}

function EditableReferences({
  citations,
  onChange,
}: {
  citations: Citation[];
  onChange: (updated: Citation[]) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRefText, setNewRefText] = useState('');
  const [newRefUrl, setNewRefUrl] = useState('');

  const handleRemove = (citationId: string) => {
    onChange(citations.filter(c => c.id !== citationId));
  };

  const handleAdd = () => {
    if (!newRefText.trim()) return;
    const newCitation: Citation = {
      id: `new-${Date.now()}`,
      index: citations.length,
      text: newRefText.trim(),
      url: newRefUrl.trim() || undefined,
    };
    onChange([...citations, newCitation]);
    setNewRefText('');
    setNewRefUrl('');
    setShowAddForm(false);
  };

  return (
    <div className="mt-3 p-3 rounded" style={{ background: '#f8f9fa', border: '1px solid var(--wiki-chrome-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--wiki-text-secondary)' }}>
          References ({citations.length})
        </span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs px-2 py-0.5 rounded cursor-pointer"
          style={{ color: 'var(--wiki-link)', border: '1px solid var(--wiki-chrome-border)', background: '#fff' }}
        >
          + Add reference
        </button>
      </div>

      {/* Add reference form */}
      {showAddForm && (
        <div className="mb-2 p-2 rounded" style={{ background: '#fff', border: '1px solid var(--wiki-chrome-border)' }}>
          <input
            type="text"
            value={newRefText}
            onChange={(e) => setNewRefText(e.target.value)}
            placeholder="Reference description (e.g., Author, Title, Year)"
            className="w-full border rounded px-2 py-1 text-xs mb-1"
            style={{ borderColor: 'var(--wiki-chrome-border)' }}
          />
          <input
            type="url"
            value={newRefUrl}
            onChange={(e) => setNewRefUrl(e.target.value)}
            placeholder="URL (optional)"
            className="w-full border rounded px-2 py-1 text-xs mb-1"
            style={{ borderColor: 'var(--wiki-chrome-border)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="text-xs px-2 py-0.5 rounded cursor-pointer text-white"
              style={{ background: 'var(--wiki-button-primary)' }}
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewRefText(''); setNewRefUrl(''); }}
              className="text-xs px-2 py-0.5 rounded cursor-pointer"
              style={{ color: 'var(--wiki-text-secondary)', border: '1px solid var(--wiki-chrome-border)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing references — editable */}
      <ol className="pl-4 space-y-1" style={{ fontSize: '0.7rem', color: 'var(--wiki-text-secondary)', lineHeight: 1.4 }}>
        {citations.map((c) => (
          <li key={c.id} className="flex items-start gap-1 group">
            <div className="flex-1 min-w-0">
              {c.url ? (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--wiki-link)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.text.slice(0, 120)}{c.text.length > 120 ? '...' : ''}
                </a>
              ) : (
                <span>{c.text.slice(0, 120)}{c.text.length > 120 ? '...' : ''}</span>
              )}
            </div>
            <button
              onClick={() => handleRemove(c.id)}
              className="text-xs cursor-pointer opacity-40 hover:opacity-100 flex-shrink-0"
              style={{ color: 'var(--wiki-error)', background: 'none', border: 'none', padding: '0 2px' }}
              title="Remove this reference"
            >
              ×
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function renderContentWithCitations(content: string, citations: ArticleSection['citations']) {
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

  return (
    <div>
      {paragraphs.map((para, pIdx) => {
        if (citations.length === 0) {
          return <p key={pIdx} style={{ marginBottom: '0.5em' }}>{para}</p>;
        }

        // Replace [n] patterns with clickable superscript citation links
        const parts: React.ReactNode[] = [];
        const regex = /\[(\d+)\]/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(para)) !== null) {
          if (match.index > lastIndex) {
            parts.push(para.slice(lastIndex, match.index));
          }
          const citationIndex = parseInt(match[1], 10);
          const citation = citations.find(c => c.index === citationIndex);

          if (citation?.url) {
            parts.push(
              <sup key={`cite-${pIdx}-${match.index}`}>
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={citation.text}
                  className="wiki-citation"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  [{citationIndex}]
                </a>
              </sup>
            );
          } else {
            parts.push(
              <sup key={`cite-${pIdx}-${match.index}`} className="wiki-citation" title={citation?.text}>
                [{citationIndex}]
              </sup>
            );
          }
          lastIndex = regex.lastIndex;
        }

        if (lastIndex < para.length) {
          parts.push(para.slice(lastIndex));
        }

        return <p key={pIdx} style={{ marginBottom: '0.5em' }}>{parts}</p>;
      })}

      {/* Inline references list — collapsed by default, from original Wikipedia snapshot */}
      {citations.length > 0 && (
        <details className="mt-2 mb-2" style={{ fontSize: '0.75rem' }}>
          <summary
            style={{ color: 'var(--wiki-text-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            References from this article ({citations.length})
          </summary>
          <ol className="mt-1 pl-4 space-y-0.5" style={{ color: 'var(--wiki-text-secondary)', fontSize: '0.7rem', lineHeight: 1.4 }}>
            {citations.map((c) => (
              <li key={c.id} value={c.index}>
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--wiki-link)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.text.slice(0, 120)}{c.text.length > 120 ? '...' : ''}
                  </a>
                ) : (
                  <span>{c.text.slice(0, 120)}{c.text.length > 120 ? '...' : ''}</span>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

export default function SectionEditor({
  section,
  isEditing,
  onToggleEdit,
  onContentChange,
  editedContent,
  onReferencesChange,
  editedCitations,
  onFocus,
  onBlur,
  hideEditLink = false,
}: SectionEditorProps) {
  const currentCitations = editedCitations !== undefined ? editedCitations : section.citations;
  const HeadingTag = section.level <= 2 ? 'h2' : 'h3';

  // Lead section (level 1) doesn't show a separate heading —
  // the article title is already rendered by ArticleRenderer
  if (section.level === 1 && section.id === 'lead') {
    const value = editedContent !== undefined ? editedContent : section.content;
    if (isEditing) {
      return (
        <div className="mb-4" style={{ border: '1px solid var(--wiki-link)', borderRadius: 2, padding: '0.5rem' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold" style={{ color: 'var(--wiki-text-secondary)' }}>Editing lead section</span>
            <button
              onClick={() => onToggleEdit(section.id)}
              className="text-xs px-3 py-1 rounded cursor-pointer"
              style={{ color: 'var(--wiki-link)', border: '1px solid var(--wiki-chrome-border)' }}
            >
              Done
            </button>
          </div>
          <textarea
            className="wiki-editor-textarea"
            value={value}
            onChange={(e) => onContentChange(section.id, e.target.value)}
            onFocus={() => onFocus?.(section.id)}
            onBlur={() => onBlur?.(section.id)}
            rows={Math.max(6, value.split('\n').length + 2)}
            autoFocus
          />
          {/* Editable references for lead section */}
          {onReferencesChange && (
            <EditableReferences
              citations={currentCitations}
              onChange={(updated) => onReferencesChange(section.id, updated)}
            />
          )}
        </div>
      );
    }
    const displayContent = editedContent !== undefined ? editedContent : section.content;
    return (
      <div className="mb-4">
        {!hideEditLink && (
          <span
            className="wiki-edit-link"
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onToggleEdit(section.id); }}
            onKeyDown={(e) => { if (e.key === 'Enter') onToggleEdit(section.id); }}
            style={{ float: 'right' }}
          >
            [edit]
          </span>
        )}
        {renderContentWithCitations(displayContent, section.citations)}
      </div>
    );
  }

  const heading = (
    <HeadingTag>
      {section.title}
      {!hideEditLink && (
        <span
          className="wiki-edit-link"
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onToggleEdit(section.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter') onToggleEdit(section.id); }}
        >
          {isEditing ? '[close]' : '[edit]'}
        </span>
      )}
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
        {/* Editable references */}
        {onReferencesChange && (
          <EditableReferences
            citations={currentCitations}
            onChange={(updated) => onReferencesChange(section.id, updated)}
          />
        )}
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
