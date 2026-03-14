/**
 * Tests for RNSLinkBudgetModal — RNode link budget and range estimator.
 * Pure frontend math, no API calls.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { RNSLinkBudgetModal } from '../../src/components/analysis/RNSLinkBudgetModal';

// CSS modules stub — jsdom doesn't parse stylesheets
vi.mock('../../src/components/analysis/RNSLinkBudgetModal.css', () => ({}));

const onClose = vi.fn();

function renderOpen() {
  return render(<RNSLinkBudgetModal isOpen={true} onClose={onClose} />);
}

beforeEach(() => {
  onClose.mockClear();
});

// ============================================================================
// Rendering
// ============================================================================

describe('RNSLinkBudgetModal — rendering', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(<RNSLinkBudgetModal isOpen={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal title when isOpen=true', () => {
    renderOpen();
    expect(screen.getByText(/RNode Link Budget & Range Estimator/i)).toBeTruthy();
  });

  it('shows Chipset dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Chipset')).toBeTruthy();
  });

  it('shows Tx Power input', () => {
    renderOpen();
    expect(screen.getByLabelText('Tx Power (dBm)')).toBeTruthy();
  });

  it('shows Spreading Factor dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Spreading Factor')).toBeTruthy();
  });

  it('shows Bandwidth dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Bandwidth (kHz)')).toBeTruthy();
  });

  it('shows Coding Rate dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Coding Rate')).toBeTruthy();
  });

  it('shows Frequency Band dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Frequency Band')).toBeTruthy();
  });

  it('shows Antenna Gain TX input', () => {
    renderOpen();
    expect(screen.getByLabelText('Antenna Gain TX (dBi)')).toBeTruthy();
  });

  it('shows Antenna Gain RX input', () => {
    renderOpen();
    expect(screen.getByLabelText('Antenna Gain RX (dBi)')).toBeTruthy();
  });

  it('shows Cable/Connector Loss input', () => {
    renderOpen();
    expect(screen.getByLabelText('Cable/Connector Loss (dB)')).toBeTruthy();
  });

  it('shows Environment dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Environment')).toBeTruthy();
  });

  it('shows Required Link Margin input', () => {
    renderOpen();
    expect(screen.getByLabelText('Required Link Margin (dB)')).toBeTruthy();
  });

  it('shows results section with expected labels', () => {
    renderOpen();
    expect(screen.getAllByText(/data rate/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/time-on-air/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/link budget/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/estimated max range/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RNS 5 bps minimum/i).length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Computation — default inputs
// ============================================================================

describe('RNSLinkBudgetModal — computation (defaults)', () => {
  // Defaults: SX1276, 17 dBm, SF7, 125 kHz, CR5, 915 MHz, 2.15/2.15 dBi, 0.5 dB loss, LOS, 10 dB margin

  it('data rate is positive for default inputs', () => {
    renderOpen();
    const items = document.querySelectorAll('.rlb-result-item');
    // First item is data rate
    const drText = items[0].querySelector('.rlb-result-value')?.textContent ?? '';
    const drValue = parseFloat(drText);
    expect(drValue).toBeGreaterThan(0);
  });

  it('time-on-air for 500-byte MTU is positive for default inputs', () => {
    renderOpen();
    const items = document.querySelectorAll('.rlb-result-item');
    const toaText = items[1].querySelector('.rlb-result-value')?.textContent ?? '';
    expect(toaText).toMatch(/\d+/);
    const ms = parseFloat(toaText.replace(/,/g, ''));
    expect(ms).toBeGreaterThan(0);
  });

  it('max range is positive for default inputs', () => {
    renderOpen();
    const items = document.querySelectorAll('.rlb-result-item');
    // 5th item is max range
    const rangeText = items[4].querySelector('.rlb-result-value')?.textContent ?? '';
    expect(rangeText).toMatch(/\d+/);
  });

  it('default SF7/BW125/CR5 passes RNS 5 bps minimum (shows PASS)', () => {
    renderOpen();
    const passEl = screen.getByText(/PASS/i);
    expect(passEl).toBeTruthy();
  });
});

// ============================================================================
// Computation — chipset comparison
// ============================================================================

describe('RNSLinkBudgetModal — computation (SX1262 vs SX1276)', () => {
  function getMaxRangeKm(): number {
    const items = document.querySelectorAll('.rlb-result-item');
    const rangeText = items[4].querySelector('.rlb-result-value')?.textContent ?? '';
    // Extract number before "km"
    const match = rangeText.match(/([\d.]+)\s*km/);
    return match ? parseFloat(match[1]) : 0;
  }

  it('SX1262 produces longer estimated range than SX1276 (better sensitivity)', () => {
    // Use SF12 where chipset sensitivity floor is the binding constraint
    // SF12/BW125: calculated = ~-137.03 dBm; SX1276 floor=-137, SX1262 floor=-140 → SX1262 wins
    const { unmount } = render(<RNSLinkBudgetModal isOpen={true} onClose={onClose} />);
    const sfSelect = screen.getByLabelText('Spreading Factor');
    fireEvent.change(sfSelect, { target: { value: '12' } });
    const rangeSX1276 = getMaxRangeKm();
    unmount();

    render(<RNSLinkBudgetModal isOpen={true} onClose={onClose} />);
    // Switch to SF12 first, then change chipset to SX1262
    const sfSelect2 = screen.getByLabelText('Spreading Factor');
    fireEvent.change(sfSelect2, { target: { value: '12' } });
    const chipsetSelect = screen.getByLabelText('Chipset');
    fireEvent.change(chipsetSelect, { target: { value: 'SX1262' } });
    const rangeSX1262 = getMaxRangeKm();

    expect(rangeSX1262).toBeGreaterThan(rangeSX1276);
  });
});

// ============================================================================
// Computation — SF comparison
// ============================================================================

describe('RNSLinkBudgetModal — computation (SF12 vs SF7)', () => {
  it('SF12 produces longer estimated range than SF7', () => {
    renderOpen();

    const items7 = document.querySelectorAll('.rlb-result-item');
    const drText7 = items7[0].querySelector('.rlb-result-value')?.textContent ?? '';
    const rangeText7 = items7[4].querySelector('.rlb-result-value')?.textContent ?? '';
    const dr7 = parseFloat(drText7);
    const range7 = parseFloat((rangeText7.match(/([\d.]+)\s*km/) ?? ['0', '0'])[1]);

    // Switch to SF12
    const sfSelect = screen.getByLabelText('Spreading Factor');
    fireEvent.change(sfSelect, { target: { value: '12' } });

    const items12 = document.querySelectorAll('.rlb-result-item');
    const drText12 = items12[0].querySelector('.rlb-result-value')?.textContent ?? '';
    const rangeText12 = items12[4].querySelector('.rlb-result-value')?.textContent ?? '';
    const dr12 = parseFloat(drText12);
    const range12 = parseFloat((rangeText12.match(/([\d.]+)\s*km/) ?? ['0', '0'])[1]);

    expect(range12).toBeGreaterThan(range7);
    expect(dr12).toBeLessThan(dr7);
  });

  it('SF12 shows Low Data Rate Optimization note', () => {
    renderOpen();
    const sfSelect = screen.getByLabelText('Spreading Factor');
    fireEvent.change(sfSelect, { target: { value: '12' } });
    expect(screen.getByText(/Low Data Rate Optimization active/i)).toBeTruthy();
  });

  it('SF7 does NOT show Low Data Rate Optimization note', () => {
    renderOpen();
    expect(screen.queryByText(/Low Data Rate Optimization active/i)).toBeNull();
  });
});

// ============================================================================
// Interaction
// ============================================================================

describe('RNSLinkBudgetModal — interaction', () => {
  it('changing chipset updates results (max Tx power changes)', () => {
    renderOpen();
    // SX1276 defaults to max 20 dBm; SX1262 allows up to 22 dBm
    // Changing chipset exposes a different max Tx power value in the Tx Power input
    // We verify the change by checking the link budget result (more Tx power → better budget)

    // First record link budget with SX1276 default (17 dBm)
    const items = document.querySelectorAll('.rlb-result-item');
    const lbBefore = items[3].querySelector('.rlb-result-value')?.textContent ?? '';

    // Switch chipset to SX1262, then raise Tx power to 22 (SX1262 allows it)
    const chipsetSelect = screen.getByLabelText('Chipset');
    fireEvent.change(chipsetSelect, { target: { value: 'SX1262' } });
    const txInput = screen.getByLabelText('Tx Power (dBm)');
    fireEvent.change(txInput, { target: { value: '22' } });
    fireEvent.blur(txInput);

    const itemsAfter = document.querySelectorAll('.rlb-result-item');
    const lbAfter = itemsAfter[3].querySelector('.rlb-result-value')?.textContent ?? '';
    // Higher Tx power → higher link budget
    expect(parseFloat(lbAfter)).toBeGreaterThan(parseFloat(lbBefore));
  });

  it('changing SF updates data rate', () => {
    renderOpen();
    const items = document.querySelectorAll('.rlb-result-item');
    const drBefore = items[0].querySelector('.rlb-result-value')?.textContent ?? '';

    const sfSelect = screen.getByLabelText('Spreading Factor');
    fireEvent.change(sfSelect, { target: { value: '12' } });

    const itemsAfter = document.querySelectorAll('.rlb-result-item');
    const drAfter = itemsAfter[0].querySelector('.rlb-result-value')?.textContent ?? '';
    expect(drAfter).not.toBe(drBefore);
  });

  it('Escape key calls onClose', () => {
    renderOpen();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('close (×) button calls onClose', () => {
    renderOpen();
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// Accessibility
// ============================================================================

describe('RNSLinkBudgetModal — accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    renderOpen();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
  });

  it('all labeled inputs have associated label elements', () => {
    renderOpen();
    const labeledIds = [
      'rlb-chipset', 'rlb-txpower', 'rlb-sf', 'rlb-bw', 'rlb-cr',
      'rlb-freq', 'rlb-gain-tx', 'rlb-gain-rx', 'rlb-cable-loss',
      'rlb-environment', 'rlb-required-margin',
    ];
    labeledIds.forEach((id) => {
      const el = document.getElementById(id);
      expect(el, `element with id "${id}" should exist`).toBeTruthy();
      const label = document.querySelector(`label[for="${id}"]`);
      expect(label, `label for "${id}" should exist`).toBeTruthy();
    });
  });

  it('passes axe accessibility check with isOpen=true', async () => {
    const { container } = renderOpen();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
