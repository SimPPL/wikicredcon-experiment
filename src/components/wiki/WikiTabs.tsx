'use client';

interface WikiTabsProps {
  mode: 'read' | 'edit';
  onModeChange?: (mode: 'read' | 'edit') => void;
}

export default function WikiTabs({ mode, onModeChange }: WikiTabsProps) {
  return (
    <div>
      {/* Row 1: Namespace tabs */}
      <div className="wiki-tabs">
        <span className="wiki-tab active" style={{ cursor: 'default' }}>
          Article
        </span>
        <span
          className="wiki-tab disabled"
          title="Talk page not available in experiment"
          style={{ cursor: 'not-allowed' }}
        >
          Talk
        </span>
      </div>

      {/* Row 2: View tabs */}
      <div className="wiki-tabs">
        <span
          className={`wiki-tab ${mode === 'read' ? 'active' : ''}`}
          onClick={() => onModeChange?.('read')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
        >
          Read
        </span>
        <span
          className={`wiki-tab ${mode === 'edit' ? 'active' : ''}`}
          onClick={() => onModeChange?.('edit')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
        >
          Edit
        </span>
        <span
          className="wiki-tab disabled"
          title="View history not available in experiment"
          style={{ cursor: 'not-allowed' }}
        >
          View history
        </span>
      </div>
    </div>
  );
}
