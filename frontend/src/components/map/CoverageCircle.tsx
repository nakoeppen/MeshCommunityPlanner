/**
 * CoverageCircle component
 * Semi-transparent circle showing node coverage based on FSPL calculations
 */

import React, { useMemo } from 'react';
import { Circle, Tooltip } from 'react-leaflet';
import type { Node } from '../../types';
import { calculateMaxDistance } from '../../utils/fspl';
import { formatDistance } from '../../utils/units';
import { getStatusColor } from '../../utils/colors';

export interface CoverageCircleProps {
  node: Node;
  color?: string;
  fillOpacity?: number;
}

const CoverageCircleComponent = ({
  node,
  color,
  fillOpacity = 0.2,
}: CoverageCircleProps) => {
  const center: [number, number] = [node.latitude, node.longitude];

  // Calculate coverage radius using FSPL
  const radiusMeters = useMemo(() => {
    return calculateMaxDistance(
      node.tx_power_dbm - (node.cable_loss_db || 0),
      node.rx_sensitivity_dbm,
      node.antenna_gain_dbi,
      node.antenna_gain_dbi, // Assume same antenna on both ends
      node.region_code
    );
  }, [
    node.tx_power_dbm,
    node.cable_loss_db,
    node.rx_sensitivity_dbm,
    node.antenna_gain_dbi,
    node.region_code,
  ]);

  // Determine color based on node status if not provided
  const circleColor = useMemo(() => {
    if (color) return color;

    // Map node status to color status
    const statusMapping: Record<string, 'online' | 'offline' | 'degraded' | 'unknown'> = {
      'configured': 'online',
      'draft': 'unknown',
      'error': 'offline',
    };

    const colorStatus = statusMapping[node.status] || 'unknown';
    return getStatusColor(colorStatus);
  }, [node.status, color]);

  return (
    <Circle
      center={center}
      radius={radiusMeters}
      pathOptions={{
        color: circleColor,
        fillColor: circleColor,
        fillOpacity: fillOpacity,
        weight: 2,
      }}
    >
      <Tooltip>
        <div className="coverage-tooltip">
          <strong>{node.name}</strong>
          <div>Coverage radius: {formatDistance(radiusMeters)}</div>
        </div>
      </Tooltip>
    </Circle>
  );
};

// Memoize to prevent re-rendering all coverage circles when one node changes
// Critical for performance with 50+ nodes
export const CoverageCircle = React.memo(CoverageCircleComponent, (prevProps, nextProps) => {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.latitude === nextProps.node.latitude &&
    prevProps.node.longitude === nextProps.node.longitude &&
    prevProps.node.tx_power_dbm === nextProps.node.tx_power_dbm &&
    prevProps.node.cable_loss_db === nextProps.node.cable_loss_db &&
    prevProps.node.rx_sensitivity_dbm === nextProps.node.rx_sensitivity_dbm &&
    prevProps.node.antenna_gain_dbi === nextProps.node.antenna_gain_dbi &&
    prevProps.node.region_code === nextProps.node.region_code &&
    prevProps.node.status === nextProps.node.status &&
    prevProps.color === nextProps.color &&
    prevProps.fillOpacity === nextProps.fillOpacity
  );
});
