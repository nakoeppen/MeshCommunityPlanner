/**
 * Tests for ReticulumAnnounceModal — safe Reticulum announce interval calculator.
 * Pure frontend math, no API calls.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ReticulumAnnounceModal } from '../../src/components/analysis/ReticulumAnnounceModal';

// CSS modules stub — jsdom doesn't parse stylesheets
vi.mock('../../src/components/analysis/ReticulumAnnounceModal.css', () => ({}));

const onClose = vi.fn();

function renderOpen() {
  return render(<ReticulumAnnounceModal isOpen={true} onClose={onClose} />);
}

beforeEach(() => {
  onClose.mockClear();
});

// ============================================================================
// Rendering
// ============================================================================

describe('ReticulumAnnounceModal — rendering', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(<ReticulumAnnounceModal isOpen={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal title when isOpen=true', () => {
    renderOpen();
    expect(screen.getByText('Announce Rate Calculator')).toBeTruthy();
  });

  it('shows Interface Type dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Interface Type')).toBeTruthy();
  });

  it('shows Announce Packet Size input for non-custom interface', () => {
    renderOpen();
    expect(screen.getByLabelText('Announce Packet Size (bytes)')).toBeTruthy();
  });

  it('shows Number of Nodes input', () => {
    renderOpen();
    expect(screen.getByLabelText('Number of Nodes')).toBeTruthy();
  });

  it('shows Target Max Utilization input', () => {
    renderOpen();
    expect(screen.getByLabelText('Target Max Utilization (%)')).toBeTruthy();
  });

  it('shows Propagation Hops input', () => {
    renderOpen();
    expect(screen.getByLabelText('Propagation Hops')).toBeTruthy();
  });

  it('shows results table with three rows (Minimum Safe, Recommended, Conservative)', () => {
    renderOpen();
    expect(screen.getByText('Minimum Safe')).toBeTruthy();
    expect(screen.getByText('Recommended (2x)')).toBeTruthy();
    expect(screen.getByText('Conservative (4x)')).toBeTruthy();
  });

  it('shows results table with correct column headers', () => {
    renderOpen();
    expect(screen.getByText('Scenario')).toBeTruthy();
    expect(screen.getByText('Announce Interval')).toBeTruthy();
    expect(screen.getByText('Channel Utilization')).toBeTruthy();
    expect(screen.getByText('Assessment')).toBeTruthy();
  });
});

// ============================================================================
// Computation — default inputs
// ============================================================================

describe('ReticulumAnnounceModal — computation (defaults)', () => {
  // Defaults: LoRa 1200bps, 72 bytes, 20 nodes, 15% utilization, 3 hops
  // announceBits = 576, airtimeSec = 0.48s
  // effectiveAnnounces = 60, minInterval = 192s, recommended = 384s, conservative = 768s

  it('Recommended interval is longer than Minimum Safe', () => {
    renderOpen();
    // Find interval cells: column index 1 in the results table
    const rows = document.querySelectorAll('.ra-table tbody tr');
    expect(rows.length).toBe(3);

    // Extract interval text
    const minSafeInterval = rows[0].querySelectorAll('td')[1].textContent ?? '';
    const recommendedInterval = rows[1].querySelectorAll('td')[1].textContent ?? '';

    // Parse numeric value — format is "Xs", "X.Xm", or "X.XXh"
    function parseIntervalSec(text: string): number {
      if (text.endsWith('h')) return parseFloat(text) * 3600;
      if (text.endsWith('m')) return parseFloat(text) * 60;
      return parseFloat(text);
    }

    expect(parseIntervalSec(recommendedInterval)).toBeGreaterThan(parseIntervalSec(minSafeInterval));
  });

  it('Conservative interval is longest of the three', () => {
    renderOpen();
    const rows = document.querySelectorAll('.ra-table tbody tr');

    function parseIntervalSec(text: string): number {
      if (text.endsWith('h')) return parseFloat(text) * 3600;
      if (text.endsWith('m')) return parseFloat(text) * 60;
      return parseFloat(text);
    }

    const recommended = parseIntervalSec(rows[1].querySelectorAll('td')[1].textContent ?? '');
    const conservative = parseIntervalSec(rows[2].querySelectorAll('td')[1].textContent ?? '');

    expect(conservative).toBeGreaterThan(recommended);
  });

  it('all three rows show channel utilization percentage', () => {
    renderOpen();
    const utilCells = document.querySelectorAll('.ra-util');
    expect(utilCells.length).toBe(3);
    utilCells.forEach((cell) => {
      expect(cell.textContent).toMatch(/\d+\.\d+%/);
    });
  });

  it('Minimum Safe row utilization matches target utilization (~15%)', () => {
    renderOpen();
    const utilCells = document.querySelectorAll('.ra-util');
    const minSafeUtil = parseFloat(utilCells[0].textContent ?? '');
    // Should be exactly 15% (minInterval is computed to hit exactly targetUtilization)
    expect(minSafeUtil).toBeCloseTo(15, 1);
  });

  it('Recommended (2x) utilization is half of Minimum Safe (~7.5%)', () => {
    renderOpen();
    const utilCells = document.querySelectorAll('.ra-util');
    const recommended = parseFloat(utilCells[1].textContent ?? '');
    expect(recommended).toBeCloseTo(7.5, 1);
  });
});

// ============================================================================
// Computation — varying inputs
// ============================================================================

describe('ReticulumAnnounceModal — computation (input changes)', () => {
  it('higher node count → longer minimum safe interval', () => {
    renderOpen();

    function parseIntervalSec(text: string): number {
      if (text.endsWith('h')) return parseFloat(text) * 3600;
      if (text.endsWith('m')) return parseFloat(text) * 60;
      return parseFloat(text);
    }

    // Capture default minInterval (20 nodes)
    const rowsBefore = document.querySelectorAll('.ra-table tbody tr');
    const intervalBefore = parseIntervalSec(rowsBefore[0].querySelectorAll('td')[1].textContent ?? '');

    // Increase node count to 100
    const nodesInput = screen.getByLabelText('Number of Nodes');
    fireEvent.change(nodesInput, { target: { value: '100' } });

    // Capture new minInterval
    const rowsAfter = document.querySelectorAll('.ra-table tbody tr');
    const intervalAfter = parseIntervalSec(rowsAfter[0].querySelectorAll('td')[1].textContent ?? '');

    expect(intervalAfter).toBeGreaterThan(intervalBefore);
  });

  it('WiFi interface → shows "effectively unlimited" note, not standard table', () => {
    renderOpen();

    // Select WiFi (index 2)
    const interfaceSelect = screen.getByLabelText('Interface Type');
    fireEvent.change(interfaceSelect, { target: { value: '2' } });

    // Standard table should be gone
    expect(screen.queryByText('Minimum Safe')).toBeNull();

    // WiFi note should appear
    expect(screen.getByText(/effectively unlimited/i)).toBeTruthy();
  });

  it('Custom interface type → custom bps input appears', () => {
    renderOpen();

    // Select Custom (index 4)
    const interfaceSelect = screen.getByLabelText('Interface Type');
    fireEvent.change(interfaceSelect, { target: { value: '4' } });

    // Custom bps input should appear
    expect(screen.getByLabelText('Custom Throughput (bps)')).toBeTruthy();
  });

  it('Custom interface type → standard table still shown with custom bps', () => {
    renderOpen();

    const interfaceSelect = screen.getByLabelText('Interface Type');
    fireEvent.change(interfaceSelect, { target: { value: '4' } });

    // Table with three rows should still be present
    expect(screen.getByText('Minimum Safe')).toBeTruthy();
    expect(screen.getByText('Recommended (2x)')).toBeTruthy();
    expect(screen.getByText('Conservative (4x)')).toBeTruthy();
  });
});

// ============================================================================
// Interaction
// ============================================================================

describe('ReticulumAnnounceModal — interaction', () => {
  it('changing interface type dropdown updates results immediately', () => {
    renderOpen();
    // Capture airtime line before change
    const before = document.querySelector('.ra-airtime-line')?.textContent ?? '';

    // Switch to LoRa Long Range 300bps (index 1)
    const interfaceSelect = screen.getByLabelText('Interface Type');
    fireEvent.change(interfaceSelect, { target: { value: '1' } });

    // Airtime line should now show 300 bps
    const after = document.querySelector('.ra-airtime-line')?.textContent ?? '';
    expect(after).toContain('300');
    expect(after).not.toBe(before);
  });

  it('changing node count updates results', () => {
    renderOpen();
    // Capture effective announces before
    const before = screen.getByText(/nodes × .* hops =/).textContent ?? '';

    // Change to 50 nodes
    const nodesInput = screen.getByLabelText('Number of Nodes');
    fireEvent.change(nodesInput, { target: { value: '50' } });

    const after = screen.getByText(/nodes × .* hops =/).textContent ?? '';
    expect(after).not.toBe(before);
    expect(after).toContain('50');
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

describe('ReticulumAnnounceModal — accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    renderOpen();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
  });

  it('all labeled inputs have associated label elements', () => {
    renderOpen();
    const labeledIds = ['ra-interface', 'ra-packet-bytes', 'ra-nodes', 'ra-target-util', 'ra-hops'];
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
