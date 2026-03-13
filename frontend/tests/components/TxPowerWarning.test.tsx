/**
 * Tests for TX power warning logic — PA signal chain, three-tier warnings.
 *
 * Uses an isolated component mirroring the warning block in AppLayout
 * to avoid the full AppLayout dependency tree.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

// ============================================================================
// Helper: pure PA gain computation (mirrors AppLayout IIFE logic)
// ============================================================================

function parseInputRangeMax(inputPowerRange: string): number {
  // \b prevents "-22" in "0-22 dBm" from being parsed as a negative number
  const m = inputPowerRange.match(/\b\d+(?:\.\d+)?/g);
  return m ? parseFloat(m[m.length - 1]) : 22;
}

function computeEffectiveOutputDbm(
  txPowerDbm: number,
  pa: { max_output_power_dbm: number; input_power_range: string } | null,
): number {
  if (!pa) return txPowerDbm;
  const paInputMax = parseInputRangeMax(pa.input_power_range);
  const paGain = pa.max_output_power_dbm - paInputMax;
  return Math.min(txPowerDbm + paGain, pa.max_output_power_dbm);
}

// ============================================================================
// Isolated warning component matching AppLayout warning logic exactly
// ============================================================================

interface WarningProps {
  txPowerDbm: number;
  deviceMaxTx: number;
  pa: { max_output_power_dbm: number; input_power_range: string } | null;
}

function TxWarnings({ txPowerDbm, deviceMaxTx, pa }: WarningProps) {
  const paInputMax = pa ? parseInputRangeMax(pa.input_power_range) : null;
  const paGain = pa ? pa.max_output_power_dbm - (paInputMax ?? 22) : 0;
  const effectiveOutputDbm = computeEffectiveOutputDbm(txPowerDbm, pa);

  const overdrivingDevice = txPowerDbm > deviceMaxTx;
  const overdrivingPaInput = pa !== null && txPowerDbm > (paInputMax ?? 22);
  const exceedsRegulatory = !overdrivingDevice && !overdrivingPaInput && effectiveOutputDbm > 30;
  const effectiveW = Math.pow(10, (effectiveOutputDbm - 30) / 10);

  return (
    <div>
      <span data-testid="effective-output">{effectiveOutputDbm.toFixed(1)}</span>
      {overdrivingDevice && (
        <p data-testid="warn-device-limit" style={{ color: '#e74c3c' }}>
          ⚠ {txPowerDbm} dBm exceeds device limit ({deviceMaxTx} dBm). Simulation only — do not transmit.
        </p>
      )}
      {!overdrivingDevice && overdrivingPaInput && (
        <p data-testid="warn-pa-overdrive" style={{ color: '#e74c3c' }}>
          ⚠ {txPowerDbm} dBm overdrives PA input (max {paInputMax} dBm). Simulation only — do not transmit.
        </p>
      )}
      {exceedsRegulatory && (
        <p data-testid="warn-regulatory" style={{ color: '#e67e22' }}>
          Effective output {effectiveOutputDbm.toFixed(1)} dBm ≈ {effectiveW.toFixed(1)}W — exceeds unlicensed limit.
        </p>
      )}
      {pa && !overdrivingDevice && !overdrivingPaInput && (
        <p data-testid="info-pa-output">
          PA output: {effectiveOutputDbm.toFixed(1)} dBm ({txPowerDbm} dBm device + {paGain} dB gain)
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Test data
// ============================================================================

const E22_PA = { max_output_power_dbm: 30, input_power_range: '0-22 dBm' };
const DEVICE_MAX_TX = 22; // T-Beam Supreme

// ============================================================================
// parseInputRangeMax — pure function tests
// ============================================================================

describe('parseInputRangeMax (pure)', () => {
  it('parses "0-22 dBm"', () => expect(parseInputRangeMax('0-22 dBm')).toBe(22));
  it('parses "0-20dBm"', () => expect(parseInputRangeMax('0-20dBm')).toBe(20));
  it('parses "-5-15"', () => expect(parseInputRangeMax('-5-15')).toBe(15));
  it('parses "22" (single)', () => expect(parseInputRangeMax('22')).toBe(22));
  it('defaults to 22 on empty string', () => expect(parseInputRangeMax('')).toBe(22));
});

// ============================================================================
// computeEffectiveOutputDbm — pure function tests
// ============================================================================

describe('computeEffectiveOutputDbm (pure)', () => {
  it('no PA: returns raw tx power', () => {
    expect(computeEffectiveOutputDbm(22, null)).toBe(22);
  });

  it('PA nominal: 15 dBm + 8 gain = 23 dBm', () => {
    expect(computeEffectiveOutputDbm(15, E22_PA)).toBeCloseTo(23);
  });

  it('PA at rated input: 22 dBm + 8 gain = 30 dBm', () => {
    expect(computeEffectiveOutputDbm(22, E22_PA)).toBeCloseTo(30);
  });

  it('PA overdriven input saturates at max output: 25 dBm → 30 dBm', () => {
    expect(computeEffectiveOutputDbm(25, E22_PA)).toBeCloseTo(30);
  });

  it('extreme overdrive still clamped to max_output', () => {
    expect(computeEffectiveOutputDbm(47, E22_PA)).toBeCloseTo(30);
  });

  it('low TX: 5 dBm + 8 gain = 13 dBm', () => {
    expect(computeEffectiveOutputDbm(5, E22_PA)).toBeCloseTo(13);
  });
});

// ============================================================================
// Warning rendering: no PA
// ============================================================================

describe('TxWarnings — no PA', () => {
  it('no warnings at 22 dBm within device limit', () => {
    render(<TxWarnings txPowerDbm={22} deviceMaxTx={22} pa={null} />);
    expect(screen.queryByTestId('warn-device-limit')).toBeNull();
    expect(screen.queryByTestId('warn-pa-overdrive')).toBeNull();
    expect(screen.queryByTestId('warn-regulatory')).toBeNull();
    expect(screen.queryByTestId('info-pa-output')).toBeNull();
  });

  it('red warning when device TX exceeds device max', () => {
    render(<TxWarnings txPowerDbm={25} deviceMaxTx={22} pa={null} />);
    expect(screen.getByTestId('warn-device-limit')).toBeInTheDocument();
    expect(screen.queryByTestId('warn-regulatory')).toBeNull();
  });

  it('orange regulatory warning at 31 dBm within device limit (hypothetical)', () => {
    render(<TxWarnings txPowerDbm={31} deviceMaxTx={47} pa={null} />);
    expect(screen.getByTestId('warn-regulatory')).toBeInTheDocument();
    expect(screen.queryByTestId('warn-device-limit')).toBeNull();
  });

  it('no regulatory warning exactly at 30 dBm', () => {
    render(<TxWarnings txPowerDbm={30} deviceMaxTx={47} pa={null} />);
    expect(screen.queryByTestId('warn-regulatory')).toBeNull();
  });

  it('device-limit warning takes priority over regulatory', () => {
    render(<TxWarnings txPowerDbm={35} deviceMaxTx={22} pa={null} />);
    expect(screen.getByTestId('warn-device-limit')).toBeInTheDocument();
    expect(screen.queryByTestId('warn-regulatory')).toBeNull();
  });
});

// ============================================================================
// Warning rendering: with PA
// ============================================================================

describe('TxWarnings — with PA (E22, gain=8)', () => {
  it('shows PA output info at nominal operation (15 dBm)', () => {
    render(<TxWarnings txPowerDbm={15} deviceMaxTx={22} pa={E22_PA} />);
    expect(screen.getByTestId('info-pa-output')).toBeInTheDocument();
    expect(screen.getByTestId('info-pa-output').textContent).toContain('23.0 dBm');
  });

  it('shows regulatory warning when effective output >30 dBm but within PA spec', () => {
    // Device outputs 14 dBm → PA output = 22 dBm → no warning
    // Device at 22 dBm → PA output = 30 → no warning (exact limit)
    // What value gives effective > 30? Impossible with E22 (max=30), so use a higher PA
    const highPa = { max_output_power_dbm: 37, input_power_range: '0-22 dBm' };
    render(<TxWarnings txPowerDbm={22} deviceMaxTx={22} pa={highPa} />);
    // effective = min(22+15, 37) = 37 dBm > 30 → orange warning
    expect(screen.getByTestId('warn-regulatory')).toBeInTheDocument();
    // PA info also shows alongside (provides effective output context)
    expect(screen.getByTestId('info-pa-output')).toBeInTheDocument();
  });

  it('red warning when device TX exceeds device max (PA present)', () => {
    render(<TxWarnings txPowerDbm={25} deviceMaxTx={22} pa={E22_PA} />);
    expect(screen.getByTestId('warn-device-limit')).toBeInTheDocument();
    expect(screen.queryByTestId('warn-pa-overdrive')).toBeNull();
    expect(screen.queryByTestId('info-pa-output')).toBeNull();
  });

  it('red PA overdrive warning when TX exceeds PA input max but within device limit', () => {
    // Device max 47, PA input max 22 — overdrive by 3 dB
    render(<TxWarnings txPowerDbm={25} deviceMaxTx={47} pa={E22_PA} />);
    expect(screen.getByTestId('warn-pa-overdrive')).toBeInTheDocument();
    expect(screen.queryByTestId('warn-device-limit')).toBeNull();
    expect(screen.queryByTestId('info-pa-output')).toBeNull();
  });

  it('device-limit warning takes priority over PA overdrive warning', () => {
    // Both device and PA overdriven — show device limit (first tier)
    render(<TxWarnings txPowerDbm={30} deviceMaxTx={22} pa={E22_PA} />);
    expect(screen.getByTestId('warn-device-limit')).toBeInTheDocument();
    expect(screen.queryByTestId('warn-pa-overdrive')).toBeNull();
  });

  it('no warning at exactly PA input max (22 dBm)', () => {
    render(<TxWarnings txPowerDbm={22} deviceMaxTx={22} pa={E22_PA} />);
    expect(screen.queryByTestId('warn-pa-overdrive')).toBeNull();
    expect(screen.queryByTestId('warn-device-limit')).toBeNull();
    // effective = 30 (not > 30)
    expect(screen.queryByTestId('warn-regulatory')).toBeNull();
    expect(screen.getByTestId('info-pa-output')).toBeInTheDocument();
  });

  it('effective output displayed correctly in info line', () => {
    render(<TxWarnings txPowerDbm={15} deviceMaxTx={22} pa={E22_PA} />);
    expect(screen.getByTestId('effective-output').textContent).toBe('23.0');
  });

  it('effective output is clamped to PA max when overdriven', () => {
    // 25 dBm device → overdriving PA input (>22) — but effective should still
    // be shown in the overdrive warning
    render(<TxWarnings txPowerDbm={25} deviceMaxTx={47} pa={E22_PA} />);
    // Effective = min(25+8, 30) = 30 even when overdrivng
    expect(screen.getByTestId('effective-output').textContent).toBe('30.0');
  });
});

// ============================================================================
// Regulatory warning content
// ============================================================================

describe('TxWarnings — regulatory warning content', () => {
  it('regulatory warning shows wattage', () => {
    // No PA, TX at 33 dBm within "hypothetical" device rated to 47
    render(<TxWarnings txPowerDbm={33} deviceMaxTx={47} pa={null} />);
    const warn = screen.getByTestId('warn-regulatory');
    // 33 dBm = ~2W
    expect(warn.textContent).toContain('W');
  });
});

// ============================================================================
// Accessibility
// ============================================================================

describe('TxWarnings — accessibility', () => {
  it('has no axe violations at nominal power (no warnings)', async () => {
    const { container } = render(<TxWarnings txPowerDbm={22} deviceMaxTx={22} pa={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with device limit warning', async () => {
    const { container } = render(<TxWarnings txPowerDbm={25} deviceMaxTx={22} pa={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with PA info shown', async () => {
    const { container } = render(<TxWarnings txPowerDbm={15} deviceMaxTx={22} pa={E22_PA} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with PA overdrive warning', async () => {
    const { container } = render(<TxWarnings txPowerDbm={25} deviceMaxTx={47} pa={E22_PA} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
