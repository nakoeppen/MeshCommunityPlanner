/**
 * LayerControls component
 * Toggle visibility for map layers: coverage, connectivity, heatmaps, etc.
 */

import React from 'react';
import { Checkbox } from '../common/Checkbox';

export interface MapLayers {
  coverageCircles: boolean;
  connectivityLines: boolean;
  heatmap: boolean;
  overlapZones: boolean;
  planningRadius: boolean;
  nodeLabels: boolean;
  fresnelZones: boolean;
}

export interface LayerControlsProps {
  layers: MapLayers;
  onLayerToggle: (layer: keyof MapLayers, enabled: boolean) => void;
  className?: string;
}

const LayerControlsComponent = ({
  layers,
  onLayerToggle,
  className = '',
}: LayerControlsProps) => {
  const handleToggle = (layer: keyof MapLayers) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onLayerToggle(layer, e.target.checked);
  };

  return (
    <div
      className={`layer-controls ${className}`}
      role="group"
      aria-label="Map layer controls"
    >
      <div className="layer-controls-header">
        <h3>Map Layers</h3>
      </div>

      <div className="layer-controls-list">
        <Checkbox
          label="Coverage Circles"
          checked={layers.coverageCircles}
          onChange={handleToggle('coverageCircles')}
        />

        <Checkbox
          label="Connectivity Lines"
          checked={layers.connectivityLines}
          onChange={handleToggle('connectivityLines')}
        />

        <Checkbox
          label="Heatmap"
          checked={layers.heatmap}
          onChange={handleToggle('heatmap')}
        />

        <Checkbox
          label="Overlap Zones"
          checked={layers.overlapZones}
          onChange={handleToggle('overlapZones')}
        />

        <Checkbox
          label="Planning Radius"
          checked={layers.planningRadius}
          onChange={handleToggle('planningRadius')}
        />

        <Checkbox
          label="Node Labels"
          checked={layers.nodeLabels}
          onChange={handleToggle('nodeLabels')}
        />

        <Checkbox
          label="Fresnel Zones"
          checked={layers.fresnelZones}
          onChange={handleToggle('fresnelZones')}
        />
      </div>

      <div className="layer-controls-legend">
        <h4>Legend</h4>
        <div className="legend-item">
          <svg width="30" height="10" aria-hidden="true">
            <line
              x1="0"
              y1="5"
              x2="30"
              y2="5"
              stroke="#059669"
              strokeWidth="3"
              strokeDasharray="0"
            />
          </svg>
          <span>Good Link (solid line)</span>
        </div>
        <div className="legend-item">
          <svg width="30" height="10" aria-hidden="true">
            <line
              x1="0"
              y1="5"
              x2="30"
              y2="5"
              stroke="#D97706"
              strokeWidth="3"
              strokeDasharray="6 3"
            />
          </svg>
          <span>Fair Link (dashed line)</span>
        </div>
        <div className="legend-item">
          <svg width="30" height="10" aria-hidden="true">
            <line
              x1="0"
              y1="5"
              x2="30"
              y2="5"
              stroke="#DC2626"
              strokeWidth="3"
              strokeDasharray="2 2"
            />
          </svg>
          <span>Poor Link (dotted line)</span>
        </div>

        <h4>Fresnel Zones</h4>
        <div className="legend-item">
          <svg width="30" height="10" aria-hidden="true">
            <line
              x1="0"
              y1="5"
              x2="30"
              y2="5"
              stroke="#16a34a"
              strokeWidth="3"
              strokeDasharray="0"
            />
          </svg>
          <span>Clear (solid green)</span>
        </div>
        <div className="legend-item">
          <svg width="30" height="10" aria-hidden="true">
            <line
              x1="0"
              y1="5"
              x2="30"
              y2="5"
              stroke="#eab308"
              strokeWidth="3"
              strokeDasharray="5 5"
            />
          </svg>
          <span>Partial (&lt;80%, dotted yellow)</span>
        </div>
        <div className="legend-item">
          <svg width="30" height="10" aria-hidden="true">
            <line
              x1="0"
              y1="5"
              x2="30"
              y2="5"
              stroke="#dc2626"
              strokeWidth="3"
              strokeDasharray="10 5"
            />
          </svg>
          <span>Obstructed (dashed red)</span>
        </div>
      </div>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders when layer state hasn't changed
export const LayerControls = React.memo(LayerControlsComponent);
