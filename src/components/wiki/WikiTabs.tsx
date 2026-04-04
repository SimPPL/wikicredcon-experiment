'use client';

interface WikiTabsProps {
  mode: 'read' | 'edit';
}

export default function WikiTabs({ mode }: WikiTabsProps) {
  return (
    <div>
      {/* Row 1: Namespace tabs */}
      <div className="wiki-tabs">
        <span className="wiki-tab active">Article</span>
        <span className="wiki-tab disabled">Talk</span>
      </div>

      {/* Row 2: View tabs */}
      <div className="wiki-tabs">
        <span className={`wiki-tab ${mode === 'read' ? 'active' : ''}`}>
          Read
        </span>
        <span className={`wiki-tab ${mode === 'edit' ? 'active' : ''}`}>
          Edit
        </span>
        <span className="wiki-tab disabled">View history</span>
      </div>
    </div>
  );
}
