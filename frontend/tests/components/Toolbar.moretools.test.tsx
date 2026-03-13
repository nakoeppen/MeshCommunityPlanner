/**
 * Tests for Toolbar — More Tools modal and protocol tab selector.
 * Kept in a separate file from Toolbar.elevation.test.tsx to avoid conflicts.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Toolbar } from '../../src/components/layout/Toolbar';

// Open the Tools dropdown
function openToolsMenu() {
  const toolsBtn = screen.getByText('Tools', { exact: false });
  fireEvent.click(toolsBtn);
}

// Open Tools dropdown then click "More Tools…"
async function openMoreToolsModal() {
  openToolsMenu();
  const moreToolsItem = await screen.findByText(/More Tools/i);
  // More Tools uses a setTimeout-based state change, wrap in act
  await act(async () => { fireEvent.click(moreToolsItem); });
  // Wait for modal to appear
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /more tools/i })).toBeTruthy());
}

describe('Toolbar — More Tools modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- "More Tools…" item ----

  it('"More Tools…" item is present in Tools dropdown', async () => {
    render(<Toolbar hasPlan />);
    openToolsMenu();
    const item = await screen.findByText(/More Tools/i);
    expect(item).toBeTruthy();
  });

  it('clicking "More Tools…" opens the More Tools modal', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    expect(screen.getByRole('dialog', { name: /more tools/i })).toBeTruthy();
  });

  // ---- Protocol tabs ----

  it('More Tools modal shows three protocol tabs', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('protocol tabs are Meshtastic, MeshCore, Reticulum', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    expect(screen.getByRole('tab', { name: 'Meshtastic' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'MeshCore' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Reticulum' })).toBeTruthy();
  });

  it('no tools shown when no tab selected — prompt message visible', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    expect(screen.getByText(/choose a protocol above/i)).toBeTruthy();
  });

  it('protocol tabs have role="tab"', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => expect(tab.getAttribute('role')).toBe('tab'));
  });

  it('tabs have aria-selected=false before any selection', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) =>
      expect(tab.getAttribute('aria-selected')).toBe('false')
    );
  });

  // ---- Meshtastic tools ----

  it('clicking Meshtastic tab shows Meshtastic tools', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    fireEvent.click(screen.getByRole('tab', { name: 'Meshtastic' }));
    expect(screen.getByText('LoRa Airtime Calculator')).toBeTruthy();
    expect(screen.getByText('Channel Capacity Estimator')).toBeTruthy();
  });

  it('Meshtastic tab has aria-selected=true when clicked', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    const tab = screen.getByRole('tab', { name: 'Meshtastic' });
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  it('other tabs have aria-selected=false when Meshtastic is selected', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    fireEvent.click(screen.getByRole('tab', { name: 'Meshtastic' }));
    expect(screen.getByRole('tab', { name: 'MeshCore' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: 'Reticulum' }).getAttribute('aria-selected')).toBe('false');
  });

  // ---- MeshCore tools ----

  it('clicking MeshCore tab shows Repeater Chain Calculator', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    fireEvent.click(screen.getByRole('tab', { name: 'MeshCore' }));
    expect(screen.getByText('Repeater Chain Calculator')).toBeTruthy();
  });

  it('MeshCore tab has aria-selected=true when clicked', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    const tab = screen.getByRole('tab', { name: 'MeshCore' });
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  // ---- Reticulum tools ----

  it('clicking Reticulum tab shows Announce Rate Calculator', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    fireEvent.click(screen.getByRole('tab', { name: 'Reticulum' }));
    expect(screen.getByText('Announce Rate Calculator')).toBeTruthy();
  });

  it('Reticulum tab has aria-selected=true when clicked', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    const tab = screen.getByRole('tab', { name: 'Reticulum' });
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  // ---- Tab switching does not bleed ----

  it('switching from Meshtastic to MeshCore hides Meshtastic tools', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    fireEvent.click(screen.getByRole('tab', { name: 'Meshtastic' }));
    expect(screen.getByText('LoRa Airtime Calculator')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'MeshCore' }));
    expect(screen.queryByText('LoRa Airtime Calculator')).toBeNull();
    expect(screen.getByText('Repeater Chain Calculator')).toBeTruthy();
  });

  // ---- Close / reset behaviours ----

  it('× button closes More Tools modal', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /more tools/i })).toBeNull()
    );
  });

  it('Escape key closes More Tools modal', async () => {
    render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /more tools/i })).toBeNull()
    );
  });

  it('closing and reopening More Tools resets to no tab selected', async () => {
    render(<Toolbar hasPlan />);
    // Open, select a tab, close
    await openMoreToolsModal();
    fireEvent.click(screen.getByRole('tab', { name: 'Meshtastic' }));
    fireEvent.click(screen.getByTitle('Close'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /more tools/i })).toBeNull()
    );
    // Reopen
    await openMoreToolsModal();
    // Prompt message should be visible (no tab selected)
    expect(screen.getByText(/choose a protocol above/i)).toBeTruthy();
    // No tool panels visible
    expect(screen.queryByText('LoRa Airtime Calculator')).toBeNull();
  });

  // ---- Accessibility ----

  it('axe passes on More Tools modal with Meshtastic tab selected', async () => {
    const { container } = render(<Toolbar hasPlan />);
    await openMoreToolsModal();
    fireEvent.click(screen.getByRole('tab', { name: 'Meshtastic' }));
    const modal = document.querySelector('.appinfo-overlay') as HTMLElement;
    const results = await axe(modal || container);
    expect(results.violations).toEqual([]);
  });
});
