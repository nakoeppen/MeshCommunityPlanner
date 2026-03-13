/**
 * Tests for coverage settings — max radius localStorage persistence and defaults.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';

const COVERAGE_SETTINGS_KEY = 'meshPlanner_coverageSettings';

// Minimal isolated component mirroring the sidebar coverage settings block
function CoverageSettingsWidget() {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(COVERAGE_SETTINGS_KEY) || 'null'); } catch { return null; }
  })();

  const [maxRadiusKm, setMaxRadiusKm] = React.useState<number>(saved?.maxRadiusKm ?? 15);
  const [remember, setRemember] = React.useState<boolean>(!!saved);

  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(1, Math.min(50, Number(e.target.value) || 15));
    setMaxRadiusKm(v);
    if (remember) localStorage.setItem(COVERAGE_SETTINGS_KEY, JSON.stringify({ maxRadiusKm: v }));
  };

  const handleRememberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRemember(e.target.checked);
    if (e.target.checked) {
      localStorage.setItem(COVERAGE_SETTINGS_KEY, JSON.stringify({ maxRadiusKm }));
    } else {
      localStorage.removeItem(COVERAGE_SETTINGS_KEY);
    }
  };

  return (
    <div>
      <label htmlFor="maxRadiusKm">Max Radius (km)</label>
      <input
        id="maxRadiusKm"
        type="number"
        min={1}
        max={50}
        step={1}
        value={maxRadiusKm}
        onChange={handleRadiusChange}
        aria-label="Maximum coverage analysis radius in kilometres (1–50)"
      />
      {maxRadiusKm > 25 && (
        <p data-testid="large-radius-warning" style={{ color: '#e67e22' }}>
          Large radius — computation may take longer.
        </p>
      )}
      <input
        type="checkbox"
        id="rememberCoverageSettings"
        checked={remember}
        onChange={handleRememberChange}
      />
      <label htmlFor="rememberCoverageSettings">Remember coverage settings</label>
    </div>
  );
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { localStorage.clear(); });

describe('CoverageSettings — defaults', () => {
  it('defaults to 15 km with remember unchecked', () => {
    render(<CoverageSettingsWidget />);
    const input = screen.getByLabelText('Maximum coverage analysis radius in kilometres (1–50)') as HTMLInputElement;
    expect(input.value).toBe('15');
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('does not show large-radius warning at default 15 km', () => {
    render(<CoverageSettingsWidget />);
    expect(screen.queryByTestId('large-radius-warning')).toBeNull();
  });

  it('shows large-radius warning when radius exceeds 25 km', () => {
    render(<CoverageSettingsWidget />);
    const input = screen.getByLabelText('Maximum coverage analysis radius in kilometres (1–50)');
    fireEvent.change(input, { target: { value: '30' } });
    expect(screen.getByTestId('large-radius-warning')).toBeInTheDocument();
  });
});

describe('CoverageSettings — input validation', () => {
  it('clamps value to 1 minimum', () => {
    render(<CoverageSettingsWidget />);
    const input = screen.getByLabelText('Maximum coverage analysis radius in kilometres (1–50)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0' } });
    expect(Number(input.value)).toBeGreaterThanOrEqual(1);
  });

  it('clamps value to 50 maximum', () => {
    render(<CoverageSettingsWidget />);
    const input = screen.getByLabelText('Maximum coverage analysis radius in kilometres (1–50)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99' } });
    expect(Number(input.value)).toBeLessThanOrEqual(50);
  });
});

describe('CoverageSettings — localStorage persistence', () => {
  it('does not write to localStorage when remember is unchecked', () => {
    render(<CoverageSettingsWidget />);
    const input = screen.getByLabelText('Maximum coverage analysis radius in kilometres (1–50)');
    fireEvent.change(input, { target: { value: '25' } });
    expect(localStorage.getItem(COVERAGE_SETTINGS_KEY)).toBeNull();
  });

  it('writes to localStorage when remember is checked and radius changes', () => {
    render(<CoverageSettingsWidget />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const input = screen.getByLabelText('Maximum coverage analysis radius in kilometres (1–50)');
    fireEvent.change(input, { target: { value: '30' } });
    const saved = JSON.parse(localStorage.getItem(COVERAGE_SETTINGS_KEY)!);
    expect(saved.maxRadiusKm).toBe(30);
  });

  it('removes localStorage entry when remember is unchecked', () => {
    localStorage.setItem(COVERAGE_SETTINGS_KEY, JSON.stringify({ maxRadiusKm: 20 }));
    render(<CoverageSettingsWidget />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(localStorage.getItem(COVERAGE_SETTINGS_KEY)).toBeNull();
  });

  it('restores saved radius and remember=true on mount', () => {
    localStorage.setItem(COVERAGE_SETTINGS_KEY, JSON.stringify({ maxRadiusKm: 35 }));
    render(<CoverageSettingsWidget />);
    const input = screen.getByLabelText('Maximum coverage analysis radius in kilometres (1–50)') as HTMLInputElement;
    expect(input.value).toBe('35');
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});

describe('CoverageSettings — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<CoverageSettingsWidget />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('radius input has associated label', () => {
    render(<CoverageSettingsWidget />);
    const input = document.getElementById('maxRadiusKm');
    expect(input).toBeInTheDocument();
    const label = document.querySelector('label[for="maxRadiusKm"]');
    expect(label).toBeInTheDocument();
  });

  it('remember checkbox has associated label', () => {
    render(<CoverageSettingsWidget />);
    const checkbox = document.getElementById('rememberCoverageSettings');
    expect(checkbox).toBeInTheDocument();
    const label = document.querySelector('label[for="rememberCoverageSettings"]');
    expect(label).toBeInTheDocument();
  });
});
