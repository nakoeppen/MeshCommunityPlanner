/**
 * Tests for MeshCoreCapacityModal — Repeater Capacity & Network Density Planner.
 * Pure frontend math, no API calls.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MeshCoreCapacityModal } from '../../src/components/analysis/MeshCoreCapacityModal';

// CSS modules stub — jsdom doesn't parse stylesheets
vi.mock('../../src/components/analysis/MeshCoreCapacityModal.css', () => ({}));

const onClose = vi.fn();

function renderOpen() {
  return render(<MeshCoreCapacityModal isOpen={true} onClose={onClose} />);
}

beforeEach(() => {
  onClose.mockClear();
});

// ============================================================================
// Rendering
// ============================================================================

describe('MeshCoreCapacityModal — rendering', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(<MeshCoreCapacityModal isOpen={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows modal title when isOpen=true', () => {
    renderOpen();
    expect(screen.getByText(/Network Density Planner/i)).toBeTruthy();
  });

  it('shows Total clients input', () => {
    renderOpen();
    expect(screen.getByLabelText('Total clients')).toBeTruthy();
  });

  it('shows Repeater count input', () => {
    renderOpen();
    expect(screen.getByLabelText('Repeater count')).toBeTruthy();
  });

  it('shows Coverage zones input', () => {
    renderOpen();
    expect(screen.getByLabelText('Coverage zones')).toBeTruthy();
  });

  it('shows Messages per client per hour input', () => {
    renderOpen();
    expect(screen.getByLabelText('Messages / client / hr')).toBeTruthy();
  });

  it('shows flood.max input', () => {
    renderOpen();
    expect(screen.getByLabelText('flood.max (hops)')).toBeTruthy();
  });

  it('shows Overlapping repeaters input', () => {
    renderOpen();
    expect(screen.getByLabelText('Overlapping repeaters')).toBeTruthy();
  });

  it('shows Deployment tier select', () => {
    renderOpen();
    expect(screen.getByLabelText('Deployment tier')).toBeTruthy();
  });

  it('shows results table with correct column headers', () => {
    renderOpen();
    expect(screen.getByText('Metric')).toBeTruthy();
    expect(screen.getByText('Value')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
  });

  it('shows the callout box about flood copies', () => {
    renderOpen();
    expect(screen.getByText(/Adding more repeaters increases flood copies/i)).toBeTruthy();
  });
});

// ============================================================================
// Computation — default inputs
// ============================================================================

describe('MeshCoreCapacityModal — computation (defaults)', () => {
  // Defaults: 20 clients, 2 repeaters, 1 zone, 5 msg/client/hr, flood.max=3, overlap=1, residential

  it('clients per repeater is 10 (ceil(20/2)) — OK under 32-client ACL', () => {
    renderOpen();
    const table = document.querySelector('.mcc-table');
    expect(table).toBeTruthy();
    const rows = table!.querySelectorAll('tbody tr');
    // First row: clients per repeater
    const firstRow = rows[0];
    const cells = firstRow.querySelectorAll('td');
    expect(cells[1].textContent).toBe('10');
    // Status badge should say OK
    expect(cells[2].textContent).toContain('OK');
  });

  it('shows Recommended flood.max row', () => {
    renderOpen();
    expect(screen.getByText(/Recommended flood\.max/i)).toBeTruthy();
  });

  it('recommended flood.max with 1 zone is 2 (max(2, 1+1))', () => {
    renderOpen();
    const table = document.querySelector('.mcc-table');
    const rows = table!.querySelectorAll('tbody tr');
    // Row 5 (index 4) = recommended flood.max
    const floodMaxRow = rows[4];
    const cells = floodMaxRow.querySelectorAll('td');
    expect(cells[1].textContent).toBe('2');
  });

  it('shows Clients per repeater label in results table', () => {
    renderOpen();
    expect(screen.getByText('Clients per repeater')).toBeTruthy();
  });

  it('shows Channel load row in results table', () => {
    renderOpen();
    expect(screen.getByText('Channel load (flood traffic)')).toBeTruthy();
  });
});

// ============================================================================
// Computation — overloaded scenario
// ============================================================================

describe('MeshCoreCapacityModal — computation (overloaded)', () => {
  it('100 clients / 1 repeater shows EXCEEDED ACL warning', () => {
    renderOpen();

    const clientsInput = screen.getByLabelText('Total clients');
    fireEvent.change(clientsInput, { target: { value: '100' } });
    fireEvent.blur(clientsInput);

    const repeaterInput = screen.getByLabelText('Repeater count');
    fireEvent.change(repeaterInput, { target: { value: '1' } });
    fireEvent.blur(repeaterInput);

    // Table first row status cell should contain EXCEEDS
    const table = document.querySelector('.mcc-table');
    const rows = table!.querySelectorAll('tbody tr');
    const firstRowStatus = rows[0].querySelectorAll('td')[2];
    expect(firstRowStatus.textContent).toContain('EXCEEDS');
  });
});

// ============================================================================
// Interaction
// ============================================================================

describe('MeshCoreCapacityModal — interaction', () => {
  it('changing client count updates the results table', () => {
    renderOpen();
    const table = document.querySelector('.mcc-table');
    const getClientsPerRepeaterCell = () =>
      table!.querySelectorAll('tbody tr')[0].querySelectorAll('td')[1];

    // Default: 20/2 = 10
    expect(getClientsPerRepeaterCell().textContent).toBe('10');

    const clientsInput = screen.getByLabelText('Total clients');
    fireEvent.change(clientsInput, { target: { value: '40' } });
    fireEvent.blur(clientsInput);

    // Now: 40/2 = 20
    expect(getClientsPerRepeaterCell().textContent).toBe('20');
  });

  it('changing flood.max updates flood copies row', () => {
    renderOpen();
    const table = document.querySelector('.mcc-table');
    const getFloodCopiesCell = () =>
      table!.querySelectorAll('tbody tr')[2].querySelectorAll('td')[1];

    // Default: min(2, 3*1) = 2
    const before = getFloodCopiesCell().textContent;

    const floodMaxInput = screen.getByLabelText('flood.max (hops)');
    fireEvent.change(floodMaxInput, { target: { value: '1' } });
    fireEvent.blur(floodMaxInput);

    const after = getFloodCopiesCell().textContent;
    // With flood.max=1 and overlap=1 and 2 repeaters: min(2, 1*1) = 1
    expect(after).toBe('1');
    expect(after).not.toBe(before);
  });

  it('Escape key calls onClose', () => {
    renderOpen();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('close (x) button calls onClose', () => {
    renderOpen();
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// Accessibility
// ============================================================================

describe('MeshCoreCapacityModal — accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    renderOpen();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
  });

  it('all labeled inputs have associated label elements', () => {
    renderOpen();
    const labeledIds = [
      'mcc-clients', 'mcc-repeaters', 'mcc-zones',
      'mcc-msg-per-client', 'mcc-flood-max', 'mcc-overlap', 'mcc-tier',
    ];
    labeledIds.forEach((id) => {
      const el = document.getElementById(id);
      expect(el, `element with id "${id}" should exist`).toBeTruthy();
      const label = document.querySelector(`label[for="${id}"]`);
      expect(label, `label for "${id}" should exist`).toBeTruthy();
    });
  });

  it('results table has role="region" with aria-label', () => {
    renderOpen();
    const region = document.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(region!.getAttribute('aria-label')).toBeTruthy();
  });

  it('passes axe accessibility check with isOpen=true and default inputs', async () => {
    const { container } = renderOpen();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
