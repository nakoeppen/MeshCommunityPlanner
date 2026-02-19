/**
 * Link Analysis Panel Component
 * Display signal strength, link margin, and link quality
 * Iteration 12, Priority 1, Task 1.2
 */

import React from 'react';

export interface LinkAnalysisData {
  signalStrength: number;
  linkMargin: number;
  pathLoss: number;
  distance: number;
  frequency: number;
  txPower: number;
  rxSensitivity: number;
  status: 'pass' | 'fail';
}

export interface LinkAnalysisProps {
  data: LinkAnalysisData;
}

export default function LinkAnalysis({ data }: LinkAnalysisProps): JSX.Element {
  const getSignalColor = (strength: number): string => {
    if (strength >= -80) return '#4CAF50';
    if (strength >= -95) return '#FFA500';
    return '#F44336';
  };

  const getSignalQuality = (strength: number): number => {
    const min = -110;
    const max = -60;
    return Math.round(((strength - min) / (max - min)) * 100);
  };

  const signalColor = getSignalColor(data.signalStrength);
  const signalQuality = getSignalQuality(data.signalStrength);
  const isMarginal = data.linkMargin < 10 && data.linkMargin > 0;

  return (
    <div data-testid="link-analysis" style={styles.container}>
      <h3 style={styles.title}>Link Analysis</h3>

      <div style={styles.statusBadge}>
        <div
          style={{
            ...styles.badge,
            backgroundColor: data.status === 'pass' ? '#4CAF50' : '#F44336',
          }}
        >
          {data.status.toUpperCase()}
        </div>
        {isMarginal && (
          <span data-testid="warning-icon" style={styles.warningIcon}>
            ⚠️
          </span>
        )}
      </div>

      <div style={styles.signalSection}>
        <div style={styles.label}>Signal Strength</div>
        <div style={styles.signalValue}>
          {data.signalStrength} dBm
        </div>
        <div
          data-testid="signal-meter"
          style={{
            ...styles.meter,
            backgroundColor: signalColor,
            width: `${signalQuality}%`,
          }}
        />
        <div style={styles.percentage}>{signalQuality}%</div>
      </div>

      <div data-testid="metrics-grid" style={styles.metricsGrid}>
        <div style={styles.metric}>
          <div style={styles.metricLabel}>Link Margin</div>
          <div style={styles.metricValue}>{data.linkMargin} dB</div>
        </div>

        <div style={styles.metric}>
          <div style={styles.metricLabel}>Path Loss</div>
          <div style={styles.metricValue}>{data.pathLoss} dB</div>
        </div>

        <div style={styles.metric}>
          <div style={styles.metricLabel}>Distance</div>
          <div style={styles.metricValue}>
            {data.distance >= 1000
              ? `${(data.distance / 1000).toFixed(1)} km`
              : `${data.distance} m`}
          </div>
        </div>

        <div style={styles.metric}>
          <div style={styles.metricLabel}>Frequency</div>
          <div style={styles.metricValue}>{data.frequency} MHz</div>
        </div>

        <div style={styles.metric}>
          <div style={styles.metricLabel}>TX Power</div>
          <div style={styles.metricValue}>{data.txPower} dBm</div>
        </div>

        <div style={styles.metric}>
          <div style={styles.metricLabel}>RX Sensitivity</div>
          <div style={styles.metricValue}>{data.rxSensitivity} dBm</div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '600',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  badge: {
    padding: '6px 12px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
  },
  warningIcon: {
    fontSize: '20px',
  },
  signalSection: {
    marginBottom: '20px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#666',
  },
  signalValue: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  meter: {
    height: '8px',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
    marginBottom: '4px',
  },
  percentage: {
    fontSize: '12px',
    color: '#666',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  metric: {
    padding: '12px',
    backgroundColor: '#F5F5F5',
    borderRadius: '6px',
  },
  metricLabel: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px',
  },
  metricValue: {
    fontSize: '16px',
    fontWeight: '600',
  },
};
