/**
 * LineOfSightIndicator component
 * Displays line-of-sight status between two nodes on the map
 */

import React from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';

export interface LOSData {
  nodeAId: string;
  nodeBId: string;
  nodeAPosition: { lat: number; lng: number };
  nodeBPosition: { lat: number; lng: number };
  hasClearLOS: boolean;
  obstructionHeight: number; // meters
  clearancePercent: number; // 0-100
}

export interface LineOfSightIndicatorProps {
  data: LOSData | null;
  visible: boolean;
  onClick?: (data: LOSData) => void;
  className?: string;
}

export function LineOfSightIndicator({
  data,
  visible,
  onClick,
  className = '',
}: LineOfSightIndicatorProps) {
  if (!visible || !data) {
    return null;
  }

  // Convert positions to Leaflet format
  const positions: LatLngExpression[] = [
    [data.nodeAPosition.lat, data.nodeAPosition.lng],
    [data.nodeBPosition.lat, data.nodeBPosition.lng],
  ];

  // Color based on LOS status
  const getColor = (): string => {
    return data.hasClearLOS ? '#16a34a' : '#dc2626'; // green-600 : red-600
  };

  // Dash pattern - solid for clear, dashed for obstructed
  const getDashArray = (): string => {
    return data.hasClearLOS ? '0' : '10, 5';
  };

  // Build tooltip content
  const getTooltipContent = (): string => {
    const status = data.hasClearLOS ? 'Clear' : 'Obstructed';
    const nodes = `${data.nodeAId} ↔ ${data.nodeBId}`;
    const clearance = `Clearance: ${data.clearancePercent}%`;
    const obstruction =
      !data.hasClearLOS && data.obstructionHeight > 0
        ? `\nObstruction: ${data.obstructionHeight}m`
        : '';

    return `Line of Sight: ${status}\n${nodes}\n${clearance}${obstruction}`;
  };

  const handleClick = () => {
    if (onClick) {
      onClick(data);
    }
  };

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: getColor(),
        weight: 3,
        opacity: 0.7,
        dashArray: getDashArray(),
      }}
      eventHandlers={{
        click: handleClick,
      }}
      className={className}
    >
      <Tooltip>{getTooltipContent()}</Tooltip>
    </Polyline>
  );
}
