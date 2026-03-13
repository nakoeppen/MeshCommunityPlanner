/**
 * StatusBar Component
 * Bottom status bar showing application state
 */

import './StatusBar.css';

interface StatusBarProps {
  status?: string;
  isLoading?: boolean;
}

export function StatusBar({ status = 'Ready', isLoading = false }: StatusBarProps) {
  return (
    <footer className="status-bar" role="contentinfo" aria-busy={isLoading}>
      <div className="status-bar-content">
        <div
          className="status-section"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isLoading && (
            <span className="status-spinner" aria-hidden="true" />
          )}
          <span className="status-text">{status}</span>
        </div>
      </div>
    </footer>
  );
}
