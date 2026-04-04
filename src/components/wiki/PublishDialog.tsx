'use client';

import { useState } from 'react';

/**
 * Replicates Wikipedia's publish dialog with edit summary,
 * minor edit checkbox, and the CC BY-SA copyright notice.
 */

interface PublishDialogProps {
  open: boolean;
  onPublish: (editSummary: string, isMinorEdit: boolean) => void;
  onCancel: () => void;
}

export default function PublishDialog({ open, onPublish, onCancel }: PublishDialogProps) {
  const [editSummary, setEditSummary] = useState('');
  const [isMinorEdit, setIsMinorEdit] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="bg-white rounded shadow-lg max-w-lg w-full mx-4"
        style={{ border: '1px solid var(--wiki-chrome-border)' }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--wiki-chrome-border)', background: '#f8f9fa' }}
        >
          <h3 className="font-semibold text-sm">Publish changes</h3>
          <button
            onClick={onCancel}
            className="text-lg cursor-pointer px-2"
            style={{ color: 'var(--wiki-text-secondary)' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Edit summary */}
          <div>
            <label className="block text-sm mb-1 font-medium" htmlFor="edit-summary">
              Edit summary
              <span className="font-normal" style={{ color: 'var(--wiki-text-secondary)' }}>
                {' '}(briefly describe your changes)
              </span>
            </label>
            <input
              id="edit-summary"
              type="text"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder="e.g., Added citation for NAION side effect, updated regulatory status"
              className="w-full px-3 py-2 text-sm rounded"
              style={{
                border: '1px solid var(--wiki-chrome-border)',
                outline: 'none',
              }}
              autoFocus
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isMinorEdit}
                onChange={(e) => setIsMinorEdit(e.target.checked)}
              />
              This is a minor edit
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" defaultChecked />
              Watch this page
            </label>
          </div>

          {/* Copyright notice — exact Wikipedia wording */}
          <div
            className="text-xs p-3 rounded"
            style={{
              background: '#f8f9fa',
              border: '1px solid var(--wiki-chrome-border)',
              color: 'var(--wiki-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            By publishing changes, you agree to the{' '}
            <span style={{ color: 'var(--wiki-link)' }}>Terms of Use</span>, and you
            irrevocably agree to release your contribution under the{' '}
            <span style={{ color: 'var(--wiki-link)' }}>CC BY-SA 4.0 License</span> and
            the <span style={{ color: 'var(--wiki-link)' }}>GFDL</span>. You agree that a
            hyperlink or URL is sufficient attribution under the Creative Commons license.
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--wiki-chrome-border)', background: '#f8f9fa' }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm cursor-pointer rounded"
            style={{
              color: 'var(--wiki-link)',
              background: 'transparent',
              border: '1px solid var(--wiki-chrome-border)',
            }}
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              className="px-4 py-1.5 text-sm cursor-pointer rounded"
              style={{
                color: 'var(--wiki-link)',
                background: 'transparent',
                border: '1px solid var(--wiki-chrome-border)',
              }}
              title="Preview not available in experiment mode"
              disabled
            >
              Show preview
            </button>
            <button
              onClick={() => onPublish(editSummary, isMinorEdit)}
              className="px-5 py-1.5 text-sm text-white cursor-pointer rounded font-semibold"
              style={{ backgroundColor: 'var(--wiki-button-primary)' }}
            >
              Publish changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
