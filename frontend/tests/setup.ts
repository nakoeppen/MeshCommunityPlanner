/**
 * Vitest setup file — referenced by vitest.config.ts
 * Configures DOM matchers, accessibility matchers, and global stubs.
 */

import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Auth token stub used by API calls
(window as any).__MESH_PLANNER_AUTH__ = 'test-token';

// Stub Leaflet globals — jsdom has no canvas/WebGL
(window as any).L = {
  tileLayer: () => ({ addTo: () => {}, remove: () => {}, setOpacity: () => {} }),
  map: () => ({ setView: () => {}, remove: () => {} }),
  layerGroup: () => ({ addTo: () => {}, clearLayers: () => {} }),
};
