/**
 * Terrain Profile Chart Component
 * Elevation cross-section with LOS and Fresnel zones
 * Iteration 12, Priority 1, Task 1.1
 */

import React from 'react';

export interface TerrainPoint {
  distance: number;
  elevation: number;
  los: number;
}

export interface FresnelPoint {
  distance: number;
  radius: number;
}

export interface Obstruction {
  distance: number;
  elevation: number;
  clearance: number;
}

export interface TerrainProfileData {
  points: TerrainPoint[];
  fresnelZone: FresnelPoint[];
  obstructions: Obstruction[];
}

export interface TerrainProfileProps {
  data: TerrainProfileData;
  width?: number;
  height?: number;
  units?: 'metric' | 'imperial';
  showObstructionDetails?: boolean;
  onExport?: (format: string) => void;
}

export default function TerrainProfile({
  data,
  width = 800,
  height = 400,
  units = 'metric',
  showObstructionDetails = false,
  onExport,
}: TerrainProfileProps): JSX.Element {
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const unitLabel = units === 'imperial' ? 'feet (ft)' : 'meters (m)';
  const distanceLabel = units === 'imperial' ? 'Distance (feet)' : 'Distance (meters)';

  const maxDistance = Math.max(...data.points.map(p => p.distance), 0);
  const maxElevation = Math.max(...data.points.map(p => Math.max(p.elevation, p.los)), ...data.fresnelZone.map(f => f.radius), 0);

  const xScale = (distance: number) => (distance / maxDistance) * chartWidth;
  const yScale = (elevation: number) => chartHeight - (elevation / maxElevation) * chartHeight;

  const elevationPath = data.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.distance)} ${yScale(p.elevation)}`).join(' ');
  const losPath = data.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.distance)} ${yScale(p.los)}`).join(' ');

  const fresnelUpperPath = data.fresnelZone.map((f, i) => {
    const point = data.points[i];
    const y = point ? yScale(point.los + f.radius) : yScale(f.radius);
    return `${i === 0 ? 'M' : 'L'} ${xScale(f.distance)} ${y}`;
  }).join(' ');

  const fresnelLowerPath = data.fresnelZone.slice().reverse().map((f, i) => {
    const point = data.points[data.fresnelZone.length - 1 - i];
    const y = point ? yScale(point.los - f.radius) : yScale(-f.radius);
    return `${i === 0 ? 'M' : 'L'} ${xScale(f.distance)} ${y}`;
  }).join(' ');

  const fresnelPath = `${fresnelUpperPath} ${fresnelLowerPath} Z`;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Terrain Profile</h3>
        <button onClick={() => onExport && onExport('png')} style={styles.exportButton} aria-label="Export chart">Export</button>
      </div>
      <div data-testid="terrain-chart" style={{ width: `${width}px`, height: `${height}px` }} aria-label="Terrain profile chart">
        <svg width={width} height={height} role="img" aria-label="Terrain profile chart">
          <defs>
            <pattern id="obstruction-pattern" width="8" height="8" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="8" y2="8" stroke="#F44336" strokeWidth="2" />
            </pattern>
          </defs>
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            <path data-testid="fresnel-zone" d={fresnelPath} fill="rgba(33, 150, 243, 0.1)" stroke="none" />
            <path data-testid="elevation-line" d={elevationPath} fill="none" stroke="#795548" strokeWidth="2" />
            <path data-testid="los-line" d={losPath} fill="none" stroke="#4CAF50" strokeWidth="2" strokeDasharray="5,5" />
            {data.obstructions.map((obs, i) => (
              <circle key={i} data-testid="obstruction" cx={xScale(obs.distance)} cy={yScale(obs.elevation)} r="8" fill="url(#obstruction-pattern)" stroke="#F44336" strokeWidth="2" />
            ))}
            <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#666" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2={chartHeight} stroke="#666" strokeWidth="1" />
            <text x={chartWidth / 2} y={chartHeight + 40} textAnchor="middle" fontSize="12" fill="#666">{distanceLabel}</text>
            <text x={-chartHeight / 2} y={-40} textAnchor="middle" fontSize="12" fill="#666" transform={`rotate(-90, -${chartHeight / 2}, -40)`}>Elevation ({unitLabel})</text>
          </g>
        </svg>
        <div data-testid="chart-tooltip" style={{ display: 'none' }} />
      </div>
      <div style={styles.legend}>
        <div style={styles.legendItem}><div style={{ ...styles.legendIcon, backgroundColor: '#795548' }} /><span>Terrain Elevation</span></div>
        <div style={styles.legendItem}><div style={{ ...styles.legendIcon, backgroundColor: '#4CAF50', opacity: 0.5 }} /><span>Line of Sight</span></div>
        <div style={styles.legendItem}><div style={{ ...styles.legendIcon, backgroundColor: 'rgba(33, 150, 243, 0.3)' }} /><span>Fresnel Zone</span></div>
      </div>
      {showObstructionDetails && data.obstructions.length > 0 && (
        <div style={styles.obstructionDetails}>
          <h4>Obstruction</h4>
          {data.obstructions.map((obs, i) => <div key={i}>Clearance: {obs.clearance} {unitLabel}</div>)}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  title: { margin: 0, fontSize: '18px', fontWeight: '600' },
  exportButton: { padding: '8px 16px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  legend: { display: 'flex', gap: '16px', marginTop: '16px', fontSize: '14px' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  legendIcon: { width: '20px', height: '3px' },
  obstructionDetails: { marginTop: '16px', padding: '12px', backgroundColor: '#FFEBEE', borderRadius: '4px', fontSize: '14px' },
};
