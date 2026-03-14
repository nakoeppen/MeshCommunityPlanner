/**
 * Tests for MeshCoreAirtimeModal — Airtime & Duty Cycle Budget Calculator.
 * Pure frontend math, no API calls.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MeshCoreAirtimeModal } from '../../src/components/analysis/MeshCoreAirtimeModal';

// CSS modules stub — jsdom doesn't parse stylesheets
vi.mock('../../src/components/analysis/MeshCoreAirtimeModal.css', () => ({}));

const onClose = vi.fn();

function renderOpen() {
  return render(<MeshCoreAirtimeModal isOpen={true} onClose={onClose} />);
}

beforeEach(() => {
  onClose.mockClear();
});

// ============================================================================
// Rendering
// ============================================================================

describe('MeshCoreAirtimeModal — rendering', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(<MeshCoreAirtimeModal isOpen={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows modal title when isOpen=true', () => {
    renderOpen();
    expect(screen.getByText(/Airtime.*Duty Cycle Calculator/i)).toBeTruthy();
  });

  it('shows Region select', () => {
    renderOpen();
    expect(screen.getByLabelText('Region')).toBeTruthy();
  });

  it('shows Frequency input', () => {
    renderOpen();
    expect(screen.getByLabelText('Frequency (MHz)')).toBeTruthy();
  });

  it('shows Spreading Factor select', () => {
    renderOpen();
    expect(screen.getByLabelText('Spreading Factor')).toBeTruthy();
  });

  it('shows Bandwidth select', () => {
    renderOpen();
    expect(screen.getByLabelText('Bandwidth (kHz)')).toBeTruthy();
  });

  it('shows Coding Rate select', () => {
    renderOpen();
    expect(screen.getByLabelText('Coding Rate')).toBeTruthy();
  });

  it('shows Message Payload input', () => {
    renderOpen();
    expect(screen.getByLabelText('Message Payload (bytes)')).toBeTruthy();
  });

  it('shows Messages per hour input', () => {
    renderOpen();
    expect(screen.getByLabelText('Messages per hour')).toBeTruthy();
  });

  it('shows Advert messages per hour input', () => {
    renderOpen();
    expect(screen.getByLabelText('Advert messages/hr')).toBeTruthy();
  });

  it('shows Airtime Factor input', () => {
    renderOpen();
    expect(screen.getByLabelText('Airtime Factor (AF)')).toBeTruthy();
  });

  it('shows Target duty cycle input', () => {
    renderOpen();
    expect(screen.getByLabelText('Target duty cycle (%)')).toBeTruthy();
  });
});

// ============================================================================
// Computation — default inputs
// ============================================================================

describe('MeshCoreAirtimeModal — computation (defaults)', () => {
  // Defaults: region=US, SF7, BW=62.5kHz, CR5, payload=40B,
  // 10 msg/hr, 5 advert/hr, AF=9, target=5%

  it('projected duty cycle is greater than 0', () => {
    renderOpen();
    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion).toBeTruthy();
    // The projected duty cycle value is shown — it must be > 0 with default inputs
    const text = resultsRegion!.textContent ?? '';
    // Find the projected duty cycle value — it's numeric and ends with %
    const matches = text.match(/(\d+\.\d+)%/g);
    expect(matches).toBeTruthy();
    const firstPct = parseFloat(matches![0]);
    expect(firstPct).toBeGreaterThan(0);
  });

  it('AF duty cycle limit with default AF=9 is 10% (100/(9+1))', () => {
    renderOpen();
    // Results section should contain "10.00%" for the AF limit
    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('10.00%');
  });

  it('required AF for 5% target is 19 (ceil(100/5 - 1) = 19)', () => {
    renderOpen();
    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('AF = 19');
  });

  it('shows Time-on-Air labels in results', () => {
    renderOpen();
    expect(screen.getByText(/Time-on-Air per message packet/i)).toBeTruthy();
    expect(screen.getByText(/Time-on-Air per advert packet/i)).toBeTruthy();
  });
});

// ============================================================================
// Computation — EU region
// ============================================================================

describe('MeshCoreAirtimeModal — computation (EU)', () => {
  it('shows EU compliance section when region=EU', () => {
    renderOpen();
    const regionSelect = screen.getByLabelText('Region');
    fireEvent.change(regionSelect, { target: { value: 'EU' } });

    // EU compliance row should appear
    expect(screen.getByText(/EU regulatory compliance/i)).toBeTruthy();
  });

  it('shows 10% limit for h1.5 sub-band (869.525 MHz) in EU', () => {
    renderOpen();

    const regionSelect = screen.getByLabelText('Region');
    fireEvent.change(regionSelect, { target: { value: 'EU' } });

    const freqInput = screen.getByLabelText('Frequency (MHz)');
    fireEvent.change(freqInput, { target: { value: '869.525' } });
    fireEvent.blur(freqInput);

    const resultsRegion = document.querySelector('[role="region"]');
    expect(resultsRegion?.textContent).toContain('10%');
  });

  it('does NOT show EU compliance when region=US', () => {
    renderOpen();
    // Default is US — no EU compliance section
    expect(screen.queryByText(/EU regulatory compliance/i)).toBeNull();
  });
});

// ============================================================================
// Interaction
// ============================================================================

describe('MeshCoreAirtimeModal — interaction', () => {
  it('changing AF updates the duty cycle limit', () => {
    renderOpen();
    const resultsRegion = document.querySelector('[role="region"]');

    // Default AF=9 → 10.00%
    expect(resultsRegion?.textContent).toContain('10.00%');

    const afInput = screen.getByLabelText('Airtime Factor (AF)');
    fireEvent.change(afInput, { target: { value: '4' } });
    fireEvent.blur(afInput);

    // AF=4 → 100/(4+1) = 20.00%
    expect(resultsRegion?.textContent).toContain('20.00%');
  });

  it('changing messages per hour changes the projected duty cycle', () => {
    renderOpen();
    const resultsRegion = document.querySelector('[role="region"]');
    const textBefore = resultsRegion?.textContent;

    const msgInput = screen.getByLabelText('Messages per hour');
    fireEvent.change(msgInput, { target: { value: '100' } });
    fireEvent.blur(msgInput);

    const textAfter = resultsRegion?.textContent;
    // Duty cycle should be different with 100 msg/hr vs 10 msg/hr
    expect(textAfter).not.toBe(textBefore);
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

describe('MeshCoreAirtimeModal — accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    renderOpen();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
  });

  it('all labeled inputs have associated label elements', () => {
    renderOpen();
    const labeledIds = [
      'mca-region', 'mca-freq', 'mca-sf', 'mca-bw', 'mca-cr',
      'mca-payload', 'mca-msg-per-hr', 'mca-advert-per-hr', 'mca-af', 'mca-target-dc',
    ];
    labeledIds.forEach((id) => {
      const el = document.getElementById(id);
      expect(el, `element with id "${id}" should exist`).toBeTruthy();
      const label = document.querySelector(`label[for="${id}"]`);
      expect(label, `label for "${id}" should exist`).toBeTruthy();
    });
  });

  it('results section has role="region" with aria-label', () => {
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
