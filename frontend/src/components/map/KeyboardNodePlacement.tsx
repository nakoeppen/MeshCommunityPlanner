/**
 * KeyboardNodePlacement component
 * Provides keyboard-driven node placement with crosshair mode
 * Insert key: Enter placement mode
 * Arrow keys: Move crosshair
 * Enter: Place node at crosshair position
 * Escape: Cancel placement mode
 */

import React, { useEffect, useState, useRef } from 'react';

export interface KeyboardNodePlacementProps {
  mapRef: React.RefObject<any>;
  onPlaceNode: (position: { lat: number; lng: number }) => void;
  enabled?: boolean;
  initialPosition?: { lat: number; lng: number };
  className?: string;
}

export function KeyboardNodePlacement({
  mapRef,
  onPlaceNode,
  enabled = true,
  initialPosition = { lat: 0, lng: 0 },
  className = '',
}: KeyboardNodePlacementProps) {
  const [placementMode, setPlacementMode] = useState(false);
  const [crosshairPosition, setCrosshairPosition] = useState({ x: 0, y: 0 });
  const [statusMessage, setStatusMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Pixel step for crosshair movement (5px per arrow key press)
  const STEP_SIZE = 5;

  // Map pixel position to lat/lng coordinates
  const pixelToLatLng = (x: number, y: number): { lat: number; lng: number } => {
    // For now, use a simple offset from initial position
    // In a real implementation, this would use the map's projection
    const latOffset = (y - (containerRef.current?.offsetHeight || 0) / 2) * -0.0001;
    const lngOffset = (x - (containerRef.current?.offsetWidth || 0) / 2) * 0.0001;

    return {
      lat: initialPosition.lat + latOffset,
      lng: initialPosition.lng + lngOffset,
    };
  };

  useEffect(() => {
    if (!enabled) return;

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

      // Handle placement mode toggle
      if (e.key === 'Insert') {
        e.preventDefault();
        if (!placementMode) {
          // Enter placement mode - center crosshair
          const centerX = (containerRef.current?.offsetWidth || 0) / 2;
          const centerY = (containerRef.current?.offsetHeight || 0) / 2;
          setCrosshairPosition({ x: centerX, y: centerY });
          setPlacementMode(true);
          setStatusMessage('Placement mode active. Use arrow keys to move, Enter to place, Escape to cancel.');
        }
        return;
      }

      // Only handle other keys when in placement mode
      if (!placementMode) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setCrosshairPosition((pos) => ({ ...pos, y: pos.y - STEP_SIZE }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setCrosshairPosition((pos) => ({ ...pos, y: pos.y + STEP_SIZE }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCrosshairPosition((pos) => ({ ...pos, x: pos.x - STEP_SIZE }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCrosshairPosition((pos) => ({ ...pos, x: pos.x + STEP_SIZE }));
          break;
        case 'Enter':
          e.preventDefault();
          // Place node at current crosshair position
          const position = pixelToLatLng(crosshairPosition.x, crosshairPosition.y);
          onPlaceNode(position);
          setPlacementMode(false);
          setStatusMessage('Node placed successfully.');
          break;
        case 'Escape':
          e.preventDefault();
          setPlacementMode(false);
          setStatusMessage('Placement mode cancelled.');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, placementMode, crosshairPosition, onPlaceNode, initialPosition]);

  return (
    <div
      ref={containerRef}
      className={`keyboard-node-placement ${className}`}
      role="region"
      aria-label="Keyboard node placement"
    >
      {/* Crosshair indicator */}
      {placementMode && (
        <div
          className="crosshair"
          data-crosshair="true"
          style={{
            position: 'absolute',
            left: `${crosshairPosition.x}px`,
            top: `${crosshairPosition.y}px`,
            transform: 'translate(-50%, -50%)',
            width: '30px',
            height: '30px',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {/* Vertical line */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '0',
              width: '2px',
              height: '100%',
              backgroundColor: 'red',
              transform: 'translateX(-50%)',
            }}
          />
          {/* Horizontal line */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '0',
              width: '100%',
              height: '2px',
              backgroundColor: 'red',
              transform: 'translateY(-50%)',
            }}
          />
          {/* Center dot */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'red',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      )}

      {/* Instructions */}
      {placementMode && (
        <div
          className="placement-instructions"
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            fontSize: '14px',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <p style={{ margin: '0 0 5px 0' }}>
            <strong>Placement Mode Active</strong>
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Arrow keys: Move crosshair</li>
            <li>Enter: Place node</li>
            <li>Escape: Cancel</li>
          </ul>
        </div>
      )}

      {/* Screen reader status announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {statusMessage}
      </div>
    </div>
  );
}
