'use client';

type ToolbarAction = 'bold' | 'italic' | 'link' | 'cite' | 'heading' | 'undo' | 'redo';

interface EditToolbarProps {
  onAction: (action: ToolbarAction) => void;
  disabled?: boolean;
}

export default function EditToolbar({ onAction, disabled = false }: EditToolbarProps) {
  const buttons: { action: ToolbarAction; label: string; title: string }[] = [
    { action: 'bold', label: 'B', title: 'Bold' },
    { action: 'italic', label: 'I', title: 'Italic' },
    { action: 'link', label: '🔗', title: 'Insert link' },
    { action: 'cite', label: '❝', title: 'Cite' },
    { action: 'heading', label: 'H', title: 'Heading' },
  ];

  const historyButtons: { action: ToolbarAction; label: string; title: string }[] = [
    { action: 'undo', label: '↩', title: 'Undo' },
    { action: 'redo', label: '↪', title: 'Redo' },
  ];

  return (
    <div className="wiki-toolbar flex items-center gap-0.5">
      {buttons.map((btn) => (
        <button
          key={btn.action}
          title={btn.title}
          disabled={disabled}
          onClick={() => onAction(btn.action)}
          style={btn.action === 'bold' ? { fontWeight: 700 } : btn.action === 'italic' ? { fontStyle: 'italic' } : undefined}
        >
          {btn.label}
        </button>
      ))}

      <span className="mx-2 border-l border-[var(--wiki-chrome-border)] h-5 inline-block" />

      {historyButtons.map((btn) => (
        <button
          key={btn.action}
          title={btn.title}
          disabled={disabled}
          onClick={() => onAction(btn.action)}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
