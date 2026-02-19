/**
 * StatusBar Component
 * Bottom status bar showing application state
 */

import './StatusBar.css';

interface StatusBarProps {
  /** Optional status message to display (defaults to "Ready") */
  status?: string;
}

export function StatusBar({ status = 'Ready' }: StatusBarProps) {
  return (
    <footer className="status-bar" role="contentinfo">
      <div className="status-bar-content">
        <div
          className="status-section"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="status-text">{status}</span>
        </div>
        <div className="status-section">
          {/* Additional status info will be added in future phases */}
        </div>
      </div>
    </footer>
  );
}
