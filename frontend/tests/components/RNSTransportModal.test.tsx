/**
 * Tests for RNSTransportModal — Transport Node Placement Advisor.
 * Pure frontend math, no API calls.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { RNSTransportModal } from '../../src/components/analysis/RNSTransportModal';

// CSS modules stub — jsdom doesn't parse stylesheets
vi.mock('../../src/components/analysis/RNSTransportModal.css', () => ({}));

const onClose = vi.fn();

function renderOpen() {
  return render(<RNSTransportModal isOpen={true} onClose={onClose} />);
}

beforeEach(() => {
  onClose.mockClear();
});

// ============================================================================
// Rendering
// ============================================================================

describe('RNSTransportModal — rendering', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(<RNSTransportModal isOpen={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal title when isOpen=true', () => {
    renderOpen();
    expect(screen.getByText(/Transport Node Placement Advisor/i)).toBeTruthy();
  });

  it('shows Client node count input', () => {
    renderOpen();
    expect(screen.getByLabelText('Client node count')).toBeTruthy();
  });

  it('shows Coverage zones input', () => {
    renderOpen();
    expect(screen.getByLabelText('Coverage zones')).toBeTruthy();
  });

  it('shows LoRa data rate input', () => {
    renderOpen();
    expect(screen.getByLabelText('LoRa data rate (bps)')).toBeTruthy();
  });

  it('shows Announce rate per destination input', () => {
    renderOpen();
    expect(screen.getByLabelText('Announce rate per destination (seconds)')).toBeTruthy();
  });

  it('shows Active destinations in network input', () => {
    renderOpen();
    expect(screen.getByLabelText('Active destinations in network')).toBeTruthy();
  });

  it('shows Transport node interfaces dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Transport node interfaces')).toBeTruthy();
  });

  it('shows Interface mode dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Interface mode')).toBeTruthy();
  });

  it('shows results section labels', () => {
    renderOpen();
    expect(screen.getByText(/announce traffic/i)).toBeTruthy();
    expect(screen.getByText(/% of 2% announce budget/i)).toBeTruthy();
    expect(screen.getByText(/recommended min transport nodes/i)).toBeTruthy();
    expect(screen.getByText(/with redundancy/i)).toBeTruthy();
    expect(screen.getByText(/single point of failure risk/i)).toBeTruthy();
  });

  it('shows announce budget note', () => {
    renderOpen();
    expect(screen.getByText(/RNS reserves 2% of interface bandwidth/i)).toBeTruthy();
  });
});

// ============================================================================
// Computation — default inputs
// ============================================================================

describe('RNSTransportModal — computation (defaults)', () => {
  // Defaults: 10 clients, 2 zones, 1172 bps, 900s announce rate, 10 active dests, LoRa+WiFi, gateway

  it('shows recommended transport node count >= 1', () => {
    renderOpen();
    const items = document.querySelectorAll('.rnt-result-item');
    // 3rd item: recommended min transport nodes
    const countText = items[2].querySelector('.rnt-result-value')?.textContent ?? '';
    const count = parseInt(countText);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('shows announce budget percentage', () => {
    renderOpen();
    const items = document.querySelectorAll('.rnt-result-item');
    // 2nd item: % of announce budget
    const pctText = items[1].querySelector('.rnt-result-value')?.textContent ?? '';
    expect(pctText).toMatch(/\d+\.?\d*%/);
  });

  it('shows interface mode description for default gateway mode', () => {
    renderOpen();
    expect(screen.getByText(/cross-zone bridge/i)).toBeTruthy();
  });
});

// ============================================================================
// Computation — overloaded scenario
// ============================================================================

describe('RNSTransportModal — computation (overloaded)', () => {
  it('very high destination count + low data rate → budget > 100% warning', () => {
    renderOpen();

    // Set low data rate (5 bps minimum)
    const drInput = screen.getByLabelText('LoRa data rate (bps)');
    fireEvent.change(drInput, { target: { value: '5' } });
    fireEvent.blur(drInput);

    // Set high destination count
    const destInput = screen.getByLabelText('Active destinations in network');
    fireEvent.change(destInput, { target: { value: '1000' } });
    fireEvent.blur(destInput);

    // Budget should be way over — the OVER BUDGET text should appear
    const items = document.querySelectorAll('.rnt-result-item');
    const pctText = items[1].querySelector('.rnt-result-value')?.textContent ?? '';
    expect(pctText).toMatch(/OVER BUDGET/i);
  });
});

// ============================================================================
// Computation — single zone SPOF
// ============================================================================

describe('RNSTransportModal — computation (single zone)', () => {
  it('coverage_zones=1 → SPOF detected when min_transport_nodes < 2', () => {
    renderOpen();

    // Set to 1 zone
    const zonesInput = screen.getByLabelText('Coverage zones');
    fireEvent.change(zonesInput, { target: { value: '1' } });
    fireEvent.blur(zonesInput);

    const items = document.querySelectorAll('.rnt-result-item');
    // 5th item: SPOF
    const spofText = items[4].querySelector('.rnt-result-value')?.textContent ?? '';
    // With 1 zone and normal announce load, min_transport = 1 → SPOF
    expect(spofText).toMatch(/Yes/i);
  });
});

// ============================================================================
// Interaction
// ============================================================================

describe('RNSTransportModal — interaction', () => {
  it('changing data rate updates announce budget %', () => {
    renderOpen();
    const items = document.querySelectorAll('.rnt-result-item');
    const pctBefore = items[1].querySelector('.rnt-result-value')?.textContent ?? '';

    const drInput = screen.getByLabelText('LoRa data rate (bps)');
    fireEvent.change(drInput, { target: { value: '300' } });
    fireEvent.blur(drInput);

    const itemsAfter = document.querySelectorAll('.rnt-result-item');
    const pctAfter = itemsAfter[1].querySelector('.rnt-result-value')?.textContent ?? '';
    expect(pctAfter).not.toBe(pctBefore);
  });

  it('changing zones updates recommended count', () => {
    renderOpen();
    const items = document.querySelectorAll('.rnt-result-item');
    const countBefore = parseInt(items[2].querySelector('.rnt-result-value')?.textContent ?? '0');

    const zonesInput = screen.getByLabelText('Coverage zones');
    fireEvent.change(zonesInput, { target: { value: '10' } });
    fireEvent.blur(zonesInput);

    const itemsAfter = document.querySelectorAll('.rnt-result-item');
    const countAfter = parseInt(itemsAfter[2].querySelector('.rnt-result-value')?.textContent ?? '0');
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  it('changing interface mode updates the description shown', () => {
    renderOpen();
    const modeSelect = screen.getByLabelText('Interface mode');
    fireEvent.change(modeSelect, { target: { value: 'access_point' } });
    expect(screen.getByText(/leaf zone/i)).toBeTruthy();
  });

  it('convergence warning shown for many transport nodes (>10)', () => {
    renderOpen();

    // 20 zones will produce 20 transport nodes (> 10)
    const zonesInput = screen.getByLabelText('Coverage zones');
    fireEvent.change(zonesInput, { target: { value: '20' } });
    fireEvent.blur(zonesInput);

    expect(screen.getByText(/Large transport node count may slow/i)).toBeTruthy();
  });

  it('convergence warning NOT shown for small transport node count', () => {
    renderOpen();
    // Default 2 zones → 2 min transport nodes (≤ 10)
    expect(screen.queryByText(/Large transport node count may slow/i)).toBeNull();
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

describe('RNSTransportModal — accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    renderOpen();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
  });

  it('all labeled inputs have associated label elements', () => {
    renderOpen();
    const labeledIds = [
      'rnt-client-count', 'rnt-coverage-zones', 'rnt-data-rate',
      'rnt-announce-rate', 'rnt-active-dest', 'rnt-interface-config',
      'rnt-interface-mode',
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
