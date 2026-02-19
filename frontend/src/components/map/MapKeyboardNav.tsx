/**
 * MapKeyboardNav component
 * Wrapper that provides keyboard navigation for the map
 * Handles arrow keys, +/-, Enter, Tab for navigation and node selection
 */

import React, { useRef, useEffect, ReactNode } from 'react';

export interface PanDelta {
  deltaX?: number;
  deltaY?: number;
}

export interface MapKeyboardNavProps {
  children: ReactNode;
  onPan: (delta: PanDelta) => void;
  onZoom: (delta: number) => void;
  onFocus: (nodeId: string) => void;
  selectedNodeId?: string;
  onSelectNext?: () => void;
  onSelectPrevious?: () => void;
  className?: string;
}

export function MapKeyboardNav({
  children,
  onPan,
  onZoom,
  onFocus,
  selectedNodeId,
  onSelectNext,
  onSelectPrevious,
  className = '',
}: MapKeyboardNavProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hintId = useRef(`map-keyboard-hint-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow keys - pan the map
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onPan({ deltaY: -50 });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onPan({ deltaY: 50 });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPan({ deltaX: -50 });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onPan({ deltaX: 50 });
      }
      // Zoom keys
      else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        onZoom(1);
      } else if (e.key === '-') {
        e.preventDefault();
        onZoom(-1);
      }
      // Enter - focus on selected node
      else if (e.key === 'Enter' && selectedNodeId) {
        e.preventDefault();
        onFocus(selectedNodeId);
      }
      // Tab - cycle through nodes
      else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey && onSelectPrevious) {
          onSelectPrevious();
        } else if (!e.shiftKey && onSelectNext) {
          onSelectNext();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [onPan, onZoom, onFocus, selectedNodeId, onSelectNext, onSelectPrevious]);

  return (
    <>
      <div
        ref={containerRef}
        className={`map-keyboard-nav ${className}`}
        role="application"
        aria-label="Interactive map with keyboard navigation"
        aria-describedby={hintId}
        tabIndex={0}
      >
        {children}
      </div>

      {/* Screen reader hint */}
      <div id={hintId} className="sr-only">
        Use arrow keys to pan, +/- to zoom, Enter to focus on selected node, Tab
        to cycle through nodes
      </div>
    </>
  );
}
