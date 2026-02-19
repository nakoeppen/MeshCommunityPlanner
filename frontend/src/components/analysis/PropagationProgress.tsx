/**
 * Propagation Progress Component
 * Display real-time progress for propagation analysis
 * Iteration 12, Priority 2, Task 2.3
 */

import React from 'react';

export interface PropagationProgressProps {
  progress: number;
  status: string;
  onCancel?: () => void;
  elapsed?: number;
  wsConnected?: boolean;
  error?: string;
}

export default function PropagationProgress({
  progress,
  status,
  onCancel,
  elapsed,
  wsConnected,
  error,
}: PropagationProgressProps): JSX.Element {
  const isComplete = progress >= 100;

  return (
    <div data-testid="propagation-progress" style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Propagation Analysis</h3>
        {wsConnected !== undefined && (
          <div style={styles.wsStatus}>
            <span
              style={{
                ...styles.wsDot,
                backgroundColor: wsConnected ? '#4CAF50' : '#9E9E9E',
              }}
            />
            <span style={styles.wsText}>
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        )}
      </div>

      <div style={styles.statusSection}>
        <div style={styles.statusText}>{status}</div>
        {elapsed !== undefined && (
          <div style={styles.elapsedTime}>{elapsed}s elapsed</div>
        )}
      </div>

      <div style={styles.progressSection}>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Propagation progress"
          style={styles.progressBar}
        >
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
              backgroundColor: error ? '#F44336' : isComplete ? '#4CAF50' : '#2196F3',
            }}
          />
        </div>
        <div style={styles.percentage}>{progress}%</div>
      </div>

      {error && (
        <div style={styles.errorMessage}>
          <span style={styles.errorIcon}>⚠️</span>
          {error}
        </div>
      )}

      <div style={styles.actions}>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isComplete}
            style={{
              ...styles.cancelButton,
              ...(isComplete ? styles.cancelButtonDisabled : {}),
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
  },
  wsStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  wsDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  wsText: {
    fontSize: '12px',
    color: '#666',
  },
  statusSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  statusText: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  elapsedTime: {
    fontSize: '12px',
    color: '#666',
  },
  progressSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  progressBar: {
    flex: 1,
    height: '12px',
    backgroundColor: '#E0E0E0',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
  percentage: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    minWidth: '45px',
    textAlign: 'right',
  },
  errorMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#FFEBEE',
    borderRadius: '6px',
    marginBottom: '16px',
    color: '#C62828',
    fontSize: '14px',
  },
  errorIcon: {
    fontSize: '18px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#F44336',
    backgroundColor: 'white',
    border: '1px solid #F44336',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
