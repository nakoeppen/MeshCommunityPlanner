/**
 * ConnectivityLine component
 * Line connecting two nodes with overlapping coverage, styled by link quality
 */

import React, { useMemo } from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
import type { Node } from '../../types';
import { getLinkQualityColor } from '../../utils/colors';
import { formatDistance } from '../../utils/units';

export interface ConnectivityLineProps {
  nodeA: Node;
  nodeB: Node;
  quality?: number; // Link quality percentage (0-100)
}

/**
 * Calculate distance between two geographic points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const ConnectivityLineComponent = ({
  nodeA,
  nodeB,
  quality,
}: ConnectivityLineProps) => {
  const positions: [number, number][] = [
    [nodeA.latitude, nodeA.longitude],
    [nodeB.latitude, nodeB.longitude],
  ];

  // Calculate distance between nodes
  const distanceMeters = useMemo(
    () =>
      calculateDistance(
        nodeA.latitude,
        nodeA.longitude,
        nodeB.latitude,
        nodeB.longitude
      ),
    [nodeA.latitude, nodeA.longitude, nodeB.latitude, nodeB.longitude]
  );

  // Determine line style based on quality
  const lineStyle = useMemo(() => {
    if (quality === undefined) {
      // No quality data - solid line with neutral color
      return {
        color: '#6B7280',
        weight: 2,
        dashArray: undefined,
      };
    }

    // Color based on quality
    const color = getLinkQualityColor(quality);

    // Line style based on quality
    let dashArray: string | undefined;
    if (quality >= 70) {
      // Excellent - solid line
      dashArray = undefined;
    } else if (quality >= 40) {
      // Moderate - dashed line
      dashArray = '10, 5';
    } else {
      // Poor - dotted line
      dashArray = '2, 5';
    }

    return {
      color,
      weight: 3,
      dashArray,
    };
  }, [quality]);

  return (
    <Polyline positions={positions} pathOptions={lineStyle}>
      <Tooltip>
        <div className="connectivity-tooltip">
          <div>
            {nodeA.name} ↔ {nodeB.name}
          </div>
          <div>Distance: {formatDistance(distanceMeters)}</div>
          {quality !== undefined && <div>Link quality: {quality}%</div>}
        </div>
      </Tooltip>
    </Polyline>
  );
};

// Memoize to prevent re-rendering all links when one node changes
// Critical for performance with 100+ links
export const ConnectivityLine = React.memo(ConnectivityLineComponent, (prevProps, nextProps) => {
  return (
    prevProps.nodeA.id === nextProps.nodeA.id &&
    prevProps.nodeA.latitude === nextProps.nodeA.latitude &&
    prevProps.nodeA.longitude === nextProps.nodeA.longitude &&
    prevProps.nodeB.id === nextProps.nodeB.id &&
    prevProps.nodeB.latitude === nextProps.nodeB.latitude &&
    prevProps.nodeB.longitude === nextProps.nodeB.longitude &&
    prevProps.quality === nextProps.quality
  );
});
