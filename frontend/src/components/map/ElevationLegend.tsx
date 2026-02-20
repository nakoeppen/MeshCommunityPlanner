/**
 * ElevationLegend component
 * Shows hypsometric elevation color scale with opacity slider.
 * Only visible when elevation heatmap layer is enabled.
 */

import React from 'react';
import { useMapStore } from '../../stores/mapStore';
import './ElevationLegend.css';

const LEGEND_ITEMS = [
  { color: 'rgb(245, 245, 252)', label: '4500m+',     desc: 'Snow' },
  { color: 'rgb(180, 180, 180)', label: '3000m',      desc: 'Alpine' },
  { color: 'rgb(170, 90, 70)',   label: '2000m',      desc: 'Mountain' },
  { color: 'rgb(200, 120, 40)',  label: '1200m',      desc: 'High' },
  { color: 'rgb(230, 175, 45)',  label: '800m',       desc: 'Foothills' },
  { color: 'rgb(240, 230, 80)',  label: '500m',       desc: 'Uplands' },
  { color: 'rgb(180, 220, 90)',  label: '200m',       desc: 'Low hills' },
  { color: 'rgb(85, 185, 85)',   label: '50m',        desc: 'Lowland' },
  { color: 'rgb(34, 139, 34)',   label: '0m',         desc: 'Sea level' },
  { color: 'rgb(70, 130, 180)',  label: '< 0m',       desc: 'Below sea' },
];

export function ElevationLegend() {
  const elevationEnabled = useMapStore((s) => s.elevation_layer_enabled);
  const elevationOpacity = useMapStore((s) => s.elevationOpacity);
  const setElevationOpacity = useMapStore((s) => s.setElevationOpacity);

  if (!elevationEnabled) return null;

  return (
    <div className="elevation-legend">
      <div className="elevation-legend-title">Elevation</div>
      <div className="elevation-legend-items">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="elevation-legend-item">
            <span className="elevation-legend-swatch" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
            <span style={{ color: '#888', marginLeft: 'auto' }}>{item.desc}</span>
          </div>
        ))}
      </div>
      <div className="elevation-legend-separator" />
      <div className="elevation-legend-slider">
        <span>Opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={elevationOpacity}
          onChange={(e) => setElevationOpacity(parseFloat(e.target.value))}
          aria-label="Elevation layer opacity"
        />
        <span>{Math.round(elevationOpacity * 100)}%</span>
      </div>
    </div>
  );
}
