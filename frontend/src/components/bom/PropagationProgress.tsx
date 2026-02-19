/**
 * PropagationProgress component
 * Progress bar showing BOM calculation/propagation status
 */

import React from 'react';

export interface PropagationProgressProps {
  progress: number | null;
  status: string;
  subtitle?: string;
  className?: string;
}

export function PropagationProgress({
  progress,
  status,
  subtitle,
  className = '',
}: PropagationProgressProps) {
  // Clamp progress to 0-100 range
  const clampedProgress =
    progress === null ? null : Math.max(0, Math.min(100, progress));

  const isComplete = clampedProgress === 100;
  const isIndeterminate = clampedProgress === null;

  return (
    <div
      className={`propagation-progress ${isComplete ? 'completed' : ''} ${className}`}
    >
      <div className="progress-header">
        <span className="progress-status">{status}</span>
        {!isIndeterminate && (
          <span className="progress-percentage">{clampedProgress}%</span>
        )}
      </div>

      <div
        className="progress-bar"
        role="progressbar"
        aria-label={status}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isIndeterminate ? undefined : clampedProgress}
      >
        <div
          className={`progress-fill ${isIndeterminate ? 'indeterminate' : ''}`}
          style={{
            width: isIndeterminate ? '100%' : `${clampedProgress}%`,
          }}
        />
      </div>

      {subtitle && <div className="progress-subtitle">{subtitle}</div>}
    </div>
  );
}
