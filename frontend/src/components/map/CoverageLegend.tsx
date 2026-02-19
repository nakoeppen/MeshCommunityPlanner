/**
 * CoverageLegend component
 * Shows SPLAT!-style signal strength color scale with opacity slider.
 * Only visible when terrain coverage overlays are active.
 */

import React from 'react';
import { useMapStore } from '../../stores/mapStore';
import './CoverageLegend.css';

const LEGEND_ITEMS = [
  { color: 'rgb(255, 0, 0)',     label: '> -80 dBm',      desc: 'Strong' },
  { color: 'rgb(255, 128, 0)',   label: '-80 to -90',      desc: 'Good' },
  { color: 'rgb(255, 255, 0)',   label: '-90 to -100',     desc: 'Fair' },
  { color: 'rgb(0, 200, 0)',     label: '-100 to -110',    desc: 'Weak' },
  { color: 'rgb(0, 200, 200)',   label: '-110 to -120',    desc: 'Marginal' },
  { color: 'rgb(0, 0, 255)',     label: '-120 to -130',    desc: 'Limit' },
];

export function CoverageLegend() {
  const terrainOverlays = useMapStore((s) => s.terrain_coverage_overlays);
  const coverageOpacity = useMapStore((s) => s.coverageOpacity);
  const setCoverageOpacity = useMapStore((s) => s.setCoverageOpacity);

  if (terrainOverlays.length === 0) return null;

  return (
    <div className="coverage-legend">
      <div className="coverage-legend-title">Signal Strength (dBm)</div>
      <div className="coverage-legend-items">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="coverage-legend-item">
            <span className="coverage-legend-swatch" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
            <span style={{ color: '#888', marginLeft: 'auto' }}>{item.desc}</span>
          </div>
        ))}
      </div>
      <div className="coverage-legend-separator" />
      <div className="coverage-legend-slider">
        <span>Opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={coverageOpacity}
          onChange={(e) => setCoverageOpacity(parseFloat(e.target.value))}
        />
        <span>{Math.round(coverageOpacity * 100)}%</span>
      </div>
    </div>
  );
}
