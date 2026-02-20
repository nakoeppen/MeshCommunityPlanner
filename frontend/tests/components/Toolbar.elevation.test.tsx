/**
 * Tests for elevation-related items in the Toolbar component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Toolbar } from '../../src/components/layout/Toolbar';

function renderToolbarWithToolsOpen(props: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const result = render(<Toolbar hasPlan {...props} />);
  // Open the Tools dropdown
  const toolsBtn = screen.getByText('Tools', { exact: false });
  fireEvent.click(toolsBtn);
  return result;
}

describe('Toolbar — Elevation Heatmap', () => {
  it('"Elevation Heatmap" text present in Tools dropdown', () => {
    renderToolbarWithToolsOpen();
    expect(screen.getByText('Elevation Heatmap', { exact: false })).toBeInTheDocument();
  });

  it('shows checkmark when elevationEnabled=true', () => {
    renderToolbarWithToolsOpen({ elevationEnabled: true });
    const item = screen.getByText(/Elevation Heatmap/);
    expect(item.textContent).toContain('\u2713');
  });

  it('no checkmark when elevationEnabled=false', () => {
    renderToolbarWithToolsOpen({ elevationEnabled: false });
    const item = screen.getByText('Elevation Heatmap');
    expect(item.textContent).not.toContain('\u2713');
  });

  it('click calls onToggleElevation', () => {
    const onToggle = vi.fn();
    renderToolbarWithToolsOpen({ onToggleElevation: onToggle });
    const item = screen.getByText('Elevation Heatmap', { exact: false });
    fireEvent.click(item);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('button has title attribute for screen readers', () => {
    renderToolbarWithToolsOpen();
    const item = screen.getByText('Elevation Heatmap', { exact: false });
    expect(item.closest('button')).toHaveAttribute('title');
  });

  it('Tools dropdown has no accessibility violations (axe)', async () => {
    const { container } = renderToolbarWithToolsOpen();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
