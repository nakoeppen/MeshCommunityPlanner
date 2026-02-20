/**
 * Tests for ElevationLegend component.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { useMapStore } from '../../src/stores/mapStore';
import { ElevationLegend } from '../../src/components/map/ElevationLegend';

describe('ElevationLegend', () => {
  beforeEach(() => {
    useMapStore.setState({
      elevation_layer_enabled: false,
      elevationOpacity: 0.6,
    });
  });

  it('returns null when elevation_layer_enabled=false', () => {
    const { container } = render(<ElevationLegend />);
    expect(container.innerHTML).toBe('');
  });

  it('renders title, 10 swatches, and opacity slider when enabled', () => {
    useMapStore.setState({ elevation_layer_enabled: true });
    render(<ElevationLegend />);

    expect(screen.getByText('Elevation')).toBeInTheDocument();

    const swatches = document.querySelectorAll('.elevation-legend-swatch');
    expect(swatches).toHaveLength(10);

    const slider = document.querySelector('input[type="range"]');
    expect(slider).toBeInTheDocument();
  });

  it('opacity slider change updates store', () => {
    useMapStore.setState({ elevation_layer_enabled: true });
    render(<ElevationLegend />);

    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.3' } });
    expect(useMapStore.getState().elevationOpacity).toBe(0.3);
  });

  it('renders correct swatch background colors', () => {
    useMapStore.setState({ elevation_layer_enabled: true });
    render(<ElevationLegend />);

    const swatches = document.querySelectorAll('.elevation-legend-swatch') as NodeListOf<HTMLElement>;
    // First swatch: snow white 245,245,252
    expect(swatches[0].style.backgroundColor).toBe('rgb(245, 245, 252)');
    // Last swatch: below sea level steel blue 70,130,180
    expect(swatches[9].style.backgroundColor).toBe('rgb(70, 130, 180)');
  });

  it('has no accessibility violations (axe)', async () => {
    useMapStore.setState({ elevation_layer_enabled: true });
    const { container } = render(<ElevationLegend />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('opacity slider has accessible structure', () => {
    useMapStore.setState({ elevation_layer_enabled: true });
    render(<ElevationLegend />);

    const slider = document.querySelector('input[type="range"]');
    expect(slider).toBeInTheDocument();
    // Slider is within a labelled container with "Opacity" text
    expect(screen.getByText('Opacity')).toBeInTheDocument();
  });
});
