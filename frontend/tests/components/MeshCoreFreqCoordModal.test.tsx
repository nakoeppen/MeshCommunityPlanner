/**
 * Tests for MeshCoreFreqCoordModal — RF Channel Frequency Coordinator.
 * Pure frontend math, no API calls.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MeshCoreFreqCoordModal } from '../../src/components/analysis/MeshCoreFreqCoordModal';

// CSS modules stub — jsdom doesn't parse stylesheets
vi.mock('../../src/components/analysis/MeshCoreFreqCoordModal.css', () => ({}));

const onClose = vi.fn();

function renderOpen() {
  return render(<MeshCoreFreqCoordModal isOpen={true} onClose={onClose} />);
}

beforeEach(() => {
  onClose.mockClear();
});

// ============================================================================
// Rendering
// ============================================================================

describe('MeshCoreFreqCoordModal — rendering', () => {
  it('renders without crashing when isOpen=true', () => {
    const { container } = renderOpen();
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('does not render when isOpen=false', () => {
    const { container } = render(<MeshCoreFreqCoordModal isOpen={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows modal title', () => {
    renderOpen();
    expect(screen.getByText(/RF Channel Frequency Coordinator/i)).toBeTruthy();
  });

  it('shows Region select', () => {
    renderOpen();
    expect(screen.getByLabelText('Region')).toBeTruthy();
  });

  it('shows Bandwidth select', () => {
    renderOpen();
    expect(screen.getByLabelText('Bandwidth')).toBeTruthy();
  });

  it('shows Number of Zones input', () => {
    renderOpen();
    expect(screen.getByLabelText('Number of Zones')).toBeTruthy();
  });
});

// ============================================================================
// Close behavior
// ============================================================================

describe('MeshCoreFreqCoordModal — close behavior', () => {
  it('close (x) button calls onClose', () => {
    renderOpen();
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape key calls onClose', () => {
    renderOpen();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// Default inputs — 3 zones, US, 62.5 kHz, no overlaps
// ============================================================================

describe('MeshCoreFreqCoordModal — default inputs (3 zones, US, 62.5 kHz, no overlaps)', () => {
  it('shows PASS feasibility with default inputs', () => {
    renderOpen();
    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('PASS');
    expect(resultsRegion?.textContent).not.toContain('CONFLICT');
  });

  it('shows channel spacing of 125 kHz (2x 62.5 kHz)', () => {
    renderOpen();
    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('125 kHz');
  });

  it('shows correct available channel count for US 62.5 kHz (floor(26000/125) = 208)', () => {
    renderOpen();
    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('208 channels');
  });

  it('all 3 default zones receive frequency assignments (not CONFLICT)', () => {
    renderOpen();
    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).not.toContain('CONFLICT');
    // Should show 3 rows with MHz values
    const cells = document.querySelectorAll('.mcf-freq-zone-table tbody tr');
    expect(cells.length).toBe(3);
  });

  it('shows default zone names in results table', () => {
    renderOpen();
    expect(screen.getAllByText('Zone 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Zone 2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Zone 3').length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Overlap behavior
// ============================================================================

describe('MeshCoreFreqCoordModal — overlap behavior', () => {
  it('overlapping zones get different center frequencies', () => {
    renderOpen();

    // Set to 2 zones
    const zoneCountInput = screen.getByLabelText('Number of Zones');
    fireEvent.change(zoneCountInput, { target: { value: '2' } });

    // Check the overlap checkbox between Zone 1 and Zone 2
    const overlapCheckbox = document.getElementById('mcf-overlap-0-1') as HTMLInputElement;
    expect(overlapCheckbox).toBeTruthy();
    fireEvent.click(overlapCheckbox);
    expect(overlapCheckbox.checked).toBe(true);

    // Both zones should be assigned — PASS
    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('PASS');

    // They should be in different channels
    const rows = document.querySelectorAll('.mcf-freq-zone-table tbody tr');
    expect(rows.length).toBe(2);
    const row0 = rows[0].textContent ?? '';
    const row1 = rows[1].textContent ?? '';

    // Extract MHz values from each row
    const freq0Match = row0.match(/(\d+\.\d+)/);
    const freq1Match = row1.match(/(\d+\.\d+)/);
    expect(freq0Match).toBeTruthy();
    expect(freq1Match).toBeTruthy();
    // Overlapping zones must have different frequencies
    expect(freq0Match![1]).not.toBe(freq1Match![1]);
  });

  it('non-overlapping zones can share the same channel index (channel 0)', () => {
    renderOpen();

    // Set to 2 zones, NO overlap (default)
    const zoneCountInput = screen.getByLabelText('Number of Zones');
    fireEvent.change(zoneCountInput, { target: { value: '2' } });

    // Overlap checkbox should be unchecked (default)
    const overlapCheckbox = document.getElementById('mcf-overlap-0-1') as HTMLInputElement;
    expect(overlapCheckbox.checked).toBe(false);

    // Both zones get channel 0 (greedy: no constraint between them)
    const rows = document.querySelectorAll('.mcf-freq-zone-table tbody tr');
    expect(rows.length).toBe(2);
    const allText = Array.from(rows).map((r) => r.textContent ?? '');
    // Both rows should show "Ch 0"
    expect(allText[0]).toContain('Ch 0');
    expect(allText[1]).toContain('Ch 0');
  });

  it('overlapping zones receive different frequencies (not same MHz)', () => {
    renderOpen();

    const zoneCountInput = screen.getByLabelText('Number of Zones');
    fireEvent.change(zoneCountInput, { target: { value: '2' } });

    const overlapCheckbox = document.getElementById('mcf-overlap-0-1') as HTMLInputElement;
    fireEvent.click(overlapCheckbox);

    const rows = document.querySelectorAll('.mcf-freq-zone-table tbody tr');
    const text0 = rows[0].textContent ?? '';
    const text1 = rows[1].textContent ?? '';

    // Channel indices should differ
    expect(text0).toContain('Ch 0');
    expect(text1).toContain('Ch 1');
  });
});

// ============================================================================
// Zone names
// ============================================================================

describe('MeshCoreFreqCoordModal — zone names', () => {
  it('custom zone names appear in results table', () => {
    renderOpen();

    // Change Zone 1 name
    const zone1Input = document.getElementById('mcf-zone-name-0') as HTMLInputElement;
    expect(zone1Input).toBeTruthy();
    fireEvent.change(zone1Input, { target: { value: 'Downtown' } });

    // Should appear in the table
    expect(screen.getAllByText('Downtown').length).toBeGreaterThanOrEqual(1);
  });

  it('increasing zone count adds more zone name inputs', () => {
    renderOpen();
    const zoneCountInput = screen.getByLabelText('Number of Zones');
    fireEvent.change(zoneCountInput, { target: { value: '5' } });

    // Should have 5 zone name inputs
    for (let i = 0; i < 5; i++) {
      expect(document.getElementById(`mcf-zone-name-${i}`)).toBeTruthy();
    }
    expect(document.getElementById('mcf-zone-name-5')).toBeNull();
  });
});

// ============================================================================
// Bandwidth and region changes
// ============================================================================

describe('MeshCoreFreqCoordModal — bandwidth and region', () => {
  it('changing bandwidth to 250 kHz updates channel spacing to 500 kHz', () => {
    renderOpen();
    const bwSelect = screen.getByLabelText('Bandwidth');
    fireEvent.change(bwSelect, { target: { value: '250' } });
    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('500 kHz');
  });

  it('EU region with 250 kHz BW shows correct channel count (floor(7000/500) = 14)', () => {
    renderOpen();
    const regionSelect = screen.getByLabelText('Region');
    fireEvent.change(regionSelect, { target: { value: 'EU' } });
    const bwSelect = screen.getByLabelText('Bandwidth');
    fireEvent.change(bwSelect, { target: { value: '250' } });

    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('14 channels');
  });

  it('ANZ region with 125 kHz BW shows correct channel count (floor(13000/250) = 52)', () => {
    renderOpen();
    const regionSelect = screen.getByLabelText('Region');
    fireEvent.change(regionSelect, { target: { value: 'ANZ' } });
    const bwSelect = screen.getByLabelText('Bandwidth');
    fireEvent.change(bwSelect, { target: { value: '125' } });

    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('52 channels');
  });
});

// ============================================================================
// Accessibility
// ============================================================================

describe('MeshCoreFreqCoordModal — accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    renderOpen();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
  });

  it('results section has role="region" with aria-label', () => {
    renderOpen();
    const region = document.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(region!.getAttribute('aria-label')).toBeTruthy();
  });

  it('all primary labeled inputs have associated label elements', () => {
    renderOpen();
    const labeledIds = ['mcf-region', 'mcf-bw', 'mcf-zone-count'];
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
