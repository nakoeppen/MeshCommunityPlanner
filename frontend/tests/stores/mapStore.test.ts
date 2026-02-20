/**
 * Tests for elevation-related state in mapStore.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../../src/stores/mapStore';

describe('mapStore — elevation state', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    useMapStore.setState({
      elevation_layer_enabled: false,
      elevationOpacity: 0.6,
    });
  });

  it('has correct default elevation state', () => {
    const state = useMapStore.getState();
    expect(state.elevation_layer_enabled).toBe(false);
    expect(state.elevationOpacity).toBe(0.6);
  });

  it('setElevationLayerEnabled(true) toggles state', () => {
    useMapStore.getState().setElevationLayerEnabled(true);
    expect(useMapStore.getState().elevation_layer_enabled).toBe(true);
  });

  it('setElevationOpacity(0.3) updates opacity', () => {
    useMapStore.getState().setElevationOpacity(0.3);
    expect(useMapStore.getState().elevationOpacity).toBe(0.3);
  });
});
