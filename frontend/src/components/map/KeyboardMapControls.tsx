/**
 * KeyboardMapControls component
 * Provides keyboard navigation for map: arrow keys (pan), +/- (zoom), Ctrl+0 (reset), Home (center)
 */

import React, { useEffect, useRef } from 'react';

export type PanDirection = 'up' | 'down' | 'left' | 'right';

export interface KeyboardMapControlsProps {
  mapRef: React.RefObject<any>;
  onPan: (direction: PanDirection) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onCenterAll: () => void;
  showHints?: boolean;
  className?: string;
}

export function KeyboardMapControls({
  mapRef,
  onPan,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onCenterAll,
  showHints = false,
  className = '',
}: KeyboardMapControlsProps) {
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target && target.tagName) {
        const tagName = target.tagName.toLowerCase();
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Handle keyboard shortcuts
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onPan('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          onPan('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onPan('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          onPan('right');
          break;
        case '+':
        case '=': // Unshifted + on US keyboards
          e.preventDefault();
          onZoomIn();
          break;
        case '-':
          e.preventDefault();
          onZoomOut();
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onResetZoom();
          }
          break;
        case 'Home':
          e.preventDefault();
          onCenterAll();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onPan, onZoomIn, onZoomOut, onResetZoom, onCenterAll]);

  return (
    <div
      ref={controlsRef}
      className={`keyboard-map-controls ${className}`}
      role="region"
      aria-label="Keyboard map controls"
      tabIndex={-1}
    >
      {showHints && (
        <div className="keyboard-hints" role="status" aria-live="polite">
          <p>
            <strong>Keyboard controls:</strong>
          </p>
          <ul>
            <li>Arrow keys: Pan map</li>
            <li>+/- keys: Zoom in/out</li>
            <li>Ctrl+0: Reset zoom</li>
            <li>Home: Center on all nodes</li>
          </ul>
        </div>
      )}
    </div>
  );
}
