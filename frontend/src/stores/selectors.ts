/**
 * Optimized store selectors
 * Prevent unnecessary re-renders with memoized selectors
 */

import { shallow } from 'zustand/shallow';
import { usePlanStore } from './planStore';
import { useMapStore } from './mapStore';
import { useSettingsStore } from './settingsStore';

// ============================================================================
// Plan Store Selectors
// ============================================================================

/**
 * Get node count (memoized)
 */
export const useNodeCount = () =>
  usePlanStore((state) => state.nodes.length);

/**
 * Get specific node by ID (memoized)
 */
export const useNode = (nodeId: string) =>
  usePlanStore((state) => state.nodes.find((n) => n.id === nodeId));

// Note: useNodeIds removed due to infinite loop issues with array identity.
// Use usePlanStore directly: usePlanStore((state) => state.nodes.map(n => n.id))

/**
 * Get dirty flag (for save button state)
 */
export const useHasUnsavedChanges = () =>
  usePlanStore((state) => state.dirty);

/**
 * Get current plan ID (for detecting plan switches)
 */
export const usePlanId = () =>
  usePlanStore((state) => state.current_plan?.id);

/**
 * Get plan metadata (name, description, created)
 */
export const usePlanMetadata = () =>
  usePlanStore(
    (state) => ({
      name: state.current_plan?.name,
      description: state.current_plan?.description,
      created_at: state.current_plan?.created_at,
    }),
    shallow
  );

/**
 * Get topology status (whether topology is loaded)
 */
export const useHasTopology = () =>
  usePlanStore((state) => state.topology_graph !== null);

/**
 * Get coverage status for a node
 */
export const useNodeCoverageStatus = (nodeId: string) =>
  usePlanStore((state) => state.coverage_results.has(nodeId));

// ============================================================================
// Map Store Selectors
// ============================================================================

/**
 * Get map center and zoom (for map initialization)
 */
export const useMapViewport = () =>
  useMapStore((state) => state.viewport, shallow);

/**
 * Get selected node ID only (for highlighting)
 */
export const useSelectedNodeId = () =>
  useMapStore((state) => state.selected_node_id);

/**
 * Get active layers (for layer controls)
 */
export const useActiveLayers = () =>
  useMapStore((state) => state.layer_visibility, shallow);

// ============================================================================
// Settings Store Selectors
// ============================================================================

/**
 * Get theme preference
 */
export const useTheme = () =>
  useSettingsStore((state) => state.theme);

/**
 * Get distance units preference
 */
export const useDistanceUnits = () =>
  useSettingsStore((state) => state.distance_units);

/**
 * Get all preferences (for settings panel)
 */
export const useAllPreferences = () =>
  useSettingsStore(
    (state) => ({
      theme: state.theme,
      distance_units: state.distance_units,
      enable_analytics: state.enable_analytics,
      auto_save: state.auto_save,
    }),
    shallow
  );

/**
 * Get API key status (whether keys are configured)
 */
export const useHasElevationApiKey = () =>
  useSettingsStore((state) => !!state.elevation_api_key);

export const useHasGeocodingApiKey = () =>
  useSettingsStore((state) => !!state.geocoding_api_key);

// ============================================================================
// Computed Selectors (Derived State)
// ============================================================================

/**
 * Check if plan can be saved (has changes and has nodes)
 */
export const useCanSavePlan = () =>
  usePlanStore(
    (state) => state.dirty && state.nodes.length > 0
  );

// Note: useNodeCountByStatus removed due to infinite loop issues with object identity.
// Use usePlanStore directly with useMemo in your component if needed.

/**
 * Check if any nodes are selected
 */
export const useHasSelection = () =>
  useMapStore((state) => state.selected_node_id !== null);

/**
 * Get total coverage area (sum of all coverage radii)
 */
export const useTotalCoverageArea = () =>
  usePlanStore((state) => {
    let total = 0;
    state.coverage_results.forEach((result) => {
      total += Math.PI * result.radius_km * result.radius_km;
    });
    return total;
  });
