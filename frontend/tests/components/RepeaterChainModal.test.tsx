/**
 * Tests for RepeaterChainModal — hop-by-hop link budget calculator.
 * Pure frontend math, no API calls.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { RepeaterChainModal } from '../../src/components/analysis/RepeaterChainModal';

// CSS modules stub — jsdom doesn't parse stylesheets
vi.mock('../../src/components/analysis/RepeaterChainModal.css', () => ({}));

const onClose = vi.fn();

function renderOpen() {
  return render(<RepeaterChainModal isOpen={true} onClose={onClose} />);
}

beforeEach(() => {
  onClose.mockClear();
});

// ============================================================================
// Rendering
// ============================================================================

describe('RepeaterChainModal — rendering', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(<RepeaterChainModal isOpen={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal title when isOpen=true', () => {
    renderOpen();
    expect(screen.getByText('Repeater Chain Calculator')).toBeTruthy();
  });

  it('shows TX Power input', () => {
    renderOpen();
    expect(screen.getByLabelText('TX Power (dBm)')).toBeTruthy();
  });

  it('shows Antenna Gain input', () => {
    renderOpen();
    expect(screen.getByLabelText('Antenna Gain (dBi)')).toBeTruthy();
  });

  it('shows Cable Loss input', () => {
    renderOpen();
    expect(screen.getByLabelText('Cable Loss (dB)')).toBeTruthy();
  });

  it('shows Frequency input', () => {
    renderOpen();
    expect(screen.getByLabelText('Frequency (MHz)')).toBeTruthy();
  });

  it('shows Environment dropdown', () => {
    renderOpen();
    expect(screen.getByLabelText('Environment')).toBeTruthy();
  });

  it('shows RX Sensitivity input', () => {
    renderOpen();
    expect(screen.getByLabelText('RX Sensitivity (dBm)')).toBeTruthy();
  });

  it('shows hop distance slider with aria-label', () => {
    renderOpen();
    expect(screen.getByLabelText('Hop distance slider')).toBeTruthy();
  });

  it('shows number of hops slider with aria-label', () => {
    renderOpen();
    expect(screen.getByLabelText('Number of hops slider')).toBeTruthy();
  });

  it('shows results table with correct column headers', () => {
    renderOpen();
    expect(screen.getByText('Hop #')).toBeTruthy();
    expect(screen.getByText('Distance (km)')).toBeTruthy();
    expect(screen.getByText('Received Signal (dBm)')).toBeTruthy();
    expect(screen.getByText('Link Margin (dB)')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
  });
});

// ============================================================================
// Computation — default inputs
// ============================================================================

describe('RepeaterChainModal — computation (defaults)', () => {
  // Defaults: txPower=20, antennaGain=2.15, cableLoss=0.5, freq=906.875,
  // env=Open Rural (n=2.8), hopDistance=5km, numHops=3, rxSensitivity=-130

  it('default numHops=3 produces exactly 3 table body rows', () => {
    renderOpen();
    const tbody = document.querySelector('.rc-table tbody');
    expect(tbody).toBeTruthy();
    const rows = tbody!.querySelectorAll('tr');
    expect(rows).toHaveLength(3);
  });

  it('each row shows the correct hop number', () => {
    renderOpen();
    const tbody = document.querySelector('.rc-table tbody')!;
    const rows = tbody.querySelectorAll('tr');
    expect(rows[0].querySelectorAll('td')[0].textContent).toBe('1');
    expect(rows[1].querySelectorAll('td')[0].textContent).toBe('2');
    expect(rows[2].querySelectorAll('td')[0].textContent).toBe('3');
  });

  it('each row shows cumulative distance (hopDistance × hopNumber)', () => {
    renderOpen();
    const tbody = document.querySelector('.rc-table tbody')!;
    const rows = tbody.querySelectorAll('tr');
    // hopDistance=5km → cumulative: 5.0, 10.0, 15.0
    expect(rows[0].querySelectorAll('td')[1].textContent).toBe('5.0');
    expect(rows[1].querySelectorAll('td')[1].textContent).toBe('10.0');
    expect(rows[2].querySelectorAll('td')[1].textContent).toBe('15.0');
  });

  it('default inputs produce "Good" status badges (link margin ~16.5 dB)', () => {
    renderOpen();
    // All hops identical — margin is per-hop not cumulative
    const badges = document.querySelectorAll('.rc-status-badge');
    expect(badges.length).toBe(3);
    badges.forEach((badge) => {
      expect(badge.textContent).toBe('Good');
    });
  });

  it('weakest link summary card is present', () => {
    renderOpen();
    // The summary card label contains "Weakest Link"
    expect(screen.getByText(/Weakest Link/)).toBeTruthy();
  });

  it('summary line shows total chain reach', () => {
    renderOpen();
    // 5km × 3 hops = 15.0 km — appears in both the card and the summary line
    const matches = screen.getAllByText(/15\.0 km/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Verify the summary line specifically
    const summaryLine = document.querySelector('.rc-summary-line');
    expect(summaryLine?.textContent).toContain('15.0 km');
  });
});

// ============================================================================
// Computation — extreme inputs
// ============================================================================

describe('RepeaterChainModal — computation (extreme inputs)', () => {
  it('short hop distance + high TX power → all hops show Strong status', () => {
    // Set hopDistance=0.5km via number input, txPower=30, envIndex=0 (Clear LOS)
    renderOpen();

    // Change TX power
    const txInput = screen.getByLabelText('TX Power (dBm)');
    fireEvent.change(txInput, { target: { value: '30' } });

    // Change environment to Clear LOS (index 0)
    const envSelect = screen.getByLabelText('Environment');
    fireEvent.change(envSelect, { target: { value: '0' } });

    // Change hop distance via the number input (aria-label="Hop distance km")
    const hopDistInput = screen.getByLabelText('Hop distance km');
    fireEvent.change(hopDistInput, { target: { value: '0.5' } });

    // All badges should be Strong
    const badges = document.querySelectorAll('.rc-status-badge');
    badges.forEach((badge) => {
      expect(badge.textContent).toBe('Strong');
    });
  });

  it('long hop distance + very low TX power → No Link status and chain broken warning visible', () => {
    renderOpen();

    // Change TX power to minimum
    const txInput = screen.getByLabelText('TX Power (dBm)');
    fireEvent.change(txInput, { target: { value: '1' } });

    // Change environment to Urban (index 3)
    const envSelect = screen.getByLabelText('Environment');
    fireEvent.change(envSelect, { target: { value: '3' } });

    // Change hop distance to 40km via the number input
    const hopDistInput = screen.getByLabelText('Hop distance km');
    fireEvent.change(hopDistInput, { target: { value: '40' } });

    // At least one badge should be No Link
    const badges = document.querySelectorAll('.rc-status-badge');
    const noLinkBadges = Array.from(badges).filter((b) => b.textContent === 'No Link');
    expect(noLinkBadges.length).toBeGreaterThan(0);

    // Chain broken alert should be present
    const alert = document.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert!.textContent).toContain('Chain broken');
  });

  it('status badges use the correct CSS class for each status', () => {
    renderOpen();
    // Defaults give "Good" → rc-status-good
    const badge = document.querySelector('.rc-status-badge');
    expect(badge?.classList.contains('rc-status-good')).toBe(true);
  });
});

// ============================================================================
// Interaction
// ============================================================================

describe('RepeaterChainModal — interaction', () => {
  it('changing hop distance number input updates the results table', () => {
    renderOpen();
    // Default: 3 hops × 5km = 15.0km total reach — check summary line
    expect(document.querySelector('.rc-summary-line')?.textContent).toContain('15.0 km');

    // Change hop distance to 10km
    const hopDistInput = screen.getByLabelText('Hop distance km');
    fireEvent.change(hopDistInput, { target: { value: '10' } });

    // Now total reach should be 30km in the summary line
    expect(document.querySelector('.rc-summary-line')?.textContent).toContain('30.0 km');
  });

  it('changing environment dropdown updates the results', () => {
    renderOpen();
    // Capture current badge text before change
    const badgeBefore = document.querySelector('.rc-status-badge')?.textContent;

    // Switch from Open Rural to Urban (much higher path loss)
    const envSelect = screen.getByLabelText('Environment');
    fireEvent.change(envSelect, { target: { value: '3' } });

    const badgeAfter = document.querySelector('.rc-status-badge')?.textContent;
    // Status should change (either different status or same — just verify re-render)
    // With Urban (n=4.0) at 5km defaults, margin will drop significantly
    // The important thing is the table still exists and renders
    expect(document.querySelector('.rc-table')).toBeTruthy();
    // Urban at 5km will typically produce Marginal or No Link (worse than Good)
    expect(badgeAfter).not.toBe(badgeBefore);
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

describe('RepeaterChainModal — accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    renderOpen();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
  });

  it('all labeled inputs have associated label elements', () => {
    renderOpen();
    // Check each explicitly labeled input by ID
    const labeledIds = ['rc-txpower', 'rc-antgain', 'rc-cableloss', 'rc-freq', 'rc-env', 'rc-rxsens'];
    labeledIds.forEach((id) => {
      const el = document.getElementById(id);
      expect(el, `element with id "${id}" should exist`).toBeTruthy();
      const label = document.querySelector(`label[for="${id}"]`);
      expect(label, `label for "${id}" should exist`).toBeTruthy();
    });
  });

  it('passes axe accessibility check with isOpen=true and default inputs', async () => {
    const { container } = renderOpen();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
