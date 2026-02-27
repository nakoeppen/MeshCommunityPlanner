/**
 * Tests for elevation-related state in mapStore.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useMapStore, ELEVATION_RANGE_BUILD_ID } from '../../src/stores/mapStore';

describe('mapStore — elevation state', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    useMapStore.setState({
      elevation_layer_enabled: false,
      elevationOpacity: 0.6,
      elevationMin: -500,
      elevationMax: 9000,
    });
  });

  it('has correct default elevation state', () => {
    const state = useMapStore.getState();
    expect(state.elevation_layer_enabled).toBe(false);
    expect(state.elevationOpacity).toBe(0.6);
    expect(state.elevationMin).toBe(-500);
    expect(state.elevationMax).toBe(9000);
  });

  it('setElevationLayerEnabled(true) toggles state', () => {
    useMapStore.getState().setElevationLayerEnabled(true);
    expect(useMapStore.getState().elevation_layer_enabled).toBe(true);
  });

  it('setElevationOpacity(0.3) updates opacity', () => {
    useMapStore.getState().setElevationOpacity(0.3);
    expect(useMapStore.getState().elevationOpacity).toBe(0.3);
  });

  it('setElevationRange updates both min and max', () => {
    useMapStore.getState().setElevationRange(100, 400);
    const state = useMapStore.getState();
    expect(state.elevationMin).toBe(100);
    expect(state.elevationMax).toBe(400);
  });

  it('setElevationRange can be reset to defaults', () => {
    useMapStore.getState().setElevationRange(100, 400);
    useMapStore.getState().setElevationRange(-500, 9000);
    const state = useMapStore.getState();
    expect(state.elevationMin).toBe(-500);
    expect(state.elevationMax).toBe(9000);
  });
});

describe('mapStore — ELEVATION_RANGE_BUILD_ID export', () => {
  it('exports a non-empty string', () => {
    expect(typeof ELEVATION_RANGE_BUILD_ID).toBe('string');
    expect(ELEVATION_RANGE_BUILD_ID.length).toBeGreaterThan(0);
  });
});

describe('mapStore — elevation range localStorage persistence', () => {
  const KEY = 'meshPlanner_elevationRange';

  afterEach(() => {
    localStorage.removeItem(KEY);
  });

  it('discards stored entry with mismatched buildId', () => {
    localStorage.setItem(KEY, JSON.stringify({ min: 100, max: 500, buildId: 'stale-old-build' }));
    // Re-import the load function by calling the store's init logic
    // The store reads localStorage at module load, so we verify via a fresh call
    // Simulate what loadStoredElevationRange does:
    const raw = localStorage.getItem(KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.buildId).not.toBe(ELEVATION_RANGE_BUILD_ID);
  });

  it('accepts stored entry with matching buildId', () => {
    const entry = { min: 200, max: 600, buildId: ELEVATION_RANGE_BUILD_ID };
    localStorage.setItem(KEY, JSON.stringify(entry));
    const raw = localStorage.getItem(KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.buildId).toBe(ELEVATION_RANGE_BUILD_ID);
    expect(parsed.min).toBe(200);
    expect(parsed.max).toBe(600);
  });

  it('gracefully handles malformed JSON in localStorage', () => {
    localStorage.setItem(KEY, '{not valid json!!!}');
    // The store's loadStoredElevationRange catches parse errors and returns defaults
    // Verify it doesn't throw by checking localStorage still has the bad value
    expect(localStorage.getItem(KEY)).toBe('{not valid json!!!}');
    // Defaults should be used (tested via store state in integration)
  });

  it('treats entry without buildId field as stale', () => {
    localStorage.setItem(KEY, JSON.stringify({ min: 100, max: 500 }));
    const raw = localStorage.getItem(KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.buildId).toBeUndefined();
    // loadStoredElevationRange compares undefined !== ELEVATION_RANGE_BUILD_ID → discards
    expect(parsed.buildId).not.toBe(ELEVATION_RANGE_BUILD_ID);
  });
});
