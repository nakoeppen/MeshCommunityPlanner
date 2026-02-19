/**
 * ErrorDialog Component
 * Shared modal error dialog with warning icon, formatted message, and OK button.
 * Extracted from CatalogModal for reuse across the app.
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ErrorDialog.css';

export function formatErrorMessage(raw: string): string {
  let msg = raw;

  // Break long messages at sentence boundaries
  msg = msg.replace(/\. /g, '.\n\n');

  // Break at " — " (em-dash separators)
  msg = msg.replace(/ — /g, '\n\n');

  // Break before "Allowed columns" lists
  msg = msg.replace(/Allowed columns/g, '\nAllowed columns');

  // Break before "Issues:" lists
  msg = msg.replace(/Issues: /g, '\nIssues:\n');

  // Break at semicolons in error lists
  msg = msg.replace(/; /g, '\n');

  return msg.trim();
}

export function ErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <div className="error-dialog-overlay" onClick={onClose}>
      <div className="error-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="error-dialog-header">
          <span className="error-dialog-icon">&#9888;</span>
          <span className="error-dialog-title">Mesh Community Planner says</span>
        </div>
        <div className="error-dialog-body">{formatErrorMessage(message)}</div>
        <div className="error-dialog-footer">
          <button className="error-dialog-ok" onClick={onClose} autoFocus>OK</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
