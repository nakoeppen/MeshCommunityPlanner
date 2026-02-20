/**
 * Map Store
 * Manages map viewport, mode, selection, layer visibility, and analysis overlays
 */

import { create } from 'zustand';
import type { MapViewport, LayerVisibility, MapMode } from '../types';

// ============================================================================
// Analysis Overlay Types
// ============================================================================

export interface LOSOverlay {
  id: string;
  nodeAUuid: string;    // UUID for dynamic position lookup
  nodeBUuid: string;    // UUID for dynamic position lookup
  nodeAName: string;    // Display name
  nodeBName: string;    // Display name
  isViable: boolean;
  linkQuality: string;
  distanceM: number;
  linkMarginDb: number;
  receivedSignalDbm: number;
  hasLos: boolean;
  fresnelClearancePct: number;
  maxObstructionM: number;       // Terrain obstruction above LOS line (m)
  additionalLossDb: number;      // Estimated diffraction loss from terrain (dB)
  totalPathLossDb: number;       // Total path loss including terrain (dB)
  freeSpaceLossDb: number;       // Free space path loss only (dB)
  elevationSource: string;       // "srtm_30m" | "srtm_partial" | "flat_terrain" | "srtm_no_data"
  elevationMinM: number;         // Min terrain elevation along path (m)
  elevationMaxM: number;         // Max terrain elevation along path (m)
}

export interface CoverageOverlay {
  id: string;
  nodeUuid: string;     // UUID for dynamic position lookup
  nodeName: string;     // Display name
  coverageRadiusM: number;
  engine: string;
}

export interface TerrainCoverageOverlay {
  id: string;
  nodeUuid: string;
  nodeName: string;
  environment: string;
  elevationSource: string;
  computationTimeMs: number;
  points: Array<{ lat: number; lon: number; signal_dbm: number }>;
  bounds: { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
  imageDataUrl: string | null;
}

export interface ViewshedOverlay {
  id: string;
  observerUuid: string;
  observerName: string;
  results: Array<{
    nodeId: string;
    nodeName: string;
    latitude: number;
    longitude: number;
    distanceM: number;
    hasLos: boolean;
    maxObstructionM?: number;
  }>;
  visibleCount: number;
  blockedCount: number;
  terrainAvailable: boolean;
}

export interface RoutePathOverlay {
  id: string;
  sourceUuid: string;
  targetUuid: string;
  sourceName: string;
  targetName: string;
  path: string[];
  hopCount: number;
  totalDistanceM: number;
  pathLinks: Array<{
    nodeAUuid: string;
    nodeBUuid: string;
    distanceM: number;
    linkQuality: string;
  }>;
  rank: number;  // 0 = primary, 1+ = alternatives
}

export interface FloodingOverlay {
  sourceNodeId: string;
  waves: Array<{
    hopNumber: number;
    nodeIds: string[];
    cumulativeTimeMs: number;
    links: Array<{ from: string; to: string; distanceM: number }>;
  }>;
  currentWaveIndex: number;
  isPlaying: boolean;
  totalTimeMs: number;
  reachedCount: number;
  unreachedCount: number;
  animationSpeedMs?: number;
  criticalNodeIds?: string[];
  bridgeLinks?: Array<{ from: string; to: string }>;
}

export interface PlacementSuggestion {
  latitude: number;
  longitude: number;
  score: number;
  coverage_gain_km2: number;
  reason: string;
}

// ============================================================================
// Store Interface
// ============================================================================

export interface MapState {
  // Viewport state
  viewport: MapViewport;

  // Interaction mode
  mode: MapMode;

  // Selection (single for config panel)
  selected_node_id: string | null;
  // Multi-selection for group operations
  selected_node_ids: string[];
  hovered_node_id: string | null;

  // Layer visibility
  layer_visibility: LayerVisibility;

  // Temp node during placement (before wizard completes)
  temp_node: {
    latitude: number;
    longitude: number;
  } | null;

  // Analysis overlays
  los_overlays: LOSOverlay[];
  coverage_overlays: CoverageOverlay[];
  terrain_coverage_overlays: TerrainCoverageOverlay[];
  viewshed_overlays: ViewshedOverlay[];
  route_path_overlays: RoutePathOverlay[];

  // Flooding simulation overlay
  flooding_overlay: FloodingOverlay | null;

  // Placement suggestions
  placement_suggestions: PlacementSuggestion[];
  placement_coverage_radius_m: number;
  placement_search_bounds: { min_lat: number; min_lon: number; max_lat: number; max_lon: number } | null;

  // Elevation heatmap layer
  elevation_layer_enabled: boolean;
  elevationOpacity: number;

  // Coverage heatmap opacity (0..1)
  coverageOpacity: number;

  // Map invalidation (triggers invalidateSize after sidebar toggle)
  map_invalidate_counter: number;

  // Fit bounds (triggers fitBounds on plan load)
  fit_bounds_counter: number;
  fit_bounds: [[number, number], [number, number]] | null;

  // Actions
  setViewport: (viewport: MapViewport) => void;
  setMode: (mode: MapMode) => void;
  invalidateMap: () => void;
  requestFitBounds: (bounds: [[number, number], [number, number]]) => void;
  selectNode: (node_id: string | null) => void;
  toggleNodeSelection: (node_id: string) => void;
  selectMultipleNodes: (node_ids: string[]) => void;
  clearNodeSelection: () => void;
  hoverNode: (node_id: string | null) => void;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  setLayerVisibility: (visibility: Partial<LayerVisibility>) => void;
  setTempNode: (coords: { latitude: number; longitude: number } | null) => void;
  setLOSOverlays: (overlays: LOSOverlay[]) => void;
  clearLOSOverlays: () => void;
  setCoverageOverlays: (overlays: CoverageOverlay[]) => void;
  clearCoverageOverlays: () => void;
  setTerrainCoverageOverlays: (overlays: TerrainCoverageOverlay[]) => void;
  clearTerrainCoverageOverlays: () => void;
  setViewshedOverlays: (overlays: ViewshedOverlay[]) => void;
  clearViewshedOverlays: () => void;
  setRoutePathOverlays: (overlays: RoutePathOverlay[]) => void;
  clearRoutePathOverlays: () => void;
  setFloodingOverlay: (overlay: FloodingOverlay | null) => void;
  updateFloodingWaveIndex: (index: number) => void;
  setFloodingPlaying: (playing: boolean) => void;
  clearFloodingOverlay: () => void;
  setPlacementSuggestions: (suggestions: PlacementSuggestion[], coverageRadiusM?: number) => void;
  clearPlacementSuggestions: () => void;
  setPlacementSearchBounds: (bounds: { min_lat: number; min_lon: number; max_lat: number; max_lon: number }) => void;
  clearPlacementSearchBounds: () => void;
  setCoverageOpacity: (opacity: number) => void;
  setElevationLayerEnabled: (enabled: boolean) => void;
  setElevationOpacity: (opacity: number) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  viewport: {
    center: [0, 0] as [number, number],
    zoom: 2,
  },
  mode: 'view' as MapMode,
  selected_node_id: null,
  selected_node_ids: [] as string[],
  hovered_node_id: null,
  layer_visibility: {
    coverage_circles: true,
    heatmaps: false,
    connectivity_lines: true,
    overlap_zones: true,
    planning_radius: true,
    node_labels: true,
  },
  temp_node: null,
  los_overlays: [] as LOSOverlay[],
  coverage_overlays: [] as CoverageOverlay[],
  terrain_coverage_overlays: [] as TerrainCoverageOverlay[],
  viewshed_overlays: [] as ViewshedOverlay[],
  route_path_overlays: [] as RoutePathOverlay[],
  flooding_overlay: null as FloodingOverlay | null,
  placement_suggestions: [] as PlacementSuggestion[],
  placement_coverage_radius_m: 1000,
  placement_search_bounds: null as { min_lat: number; min_lon: number; max_lat: number; max_lon: number } | null,
  elevation_layer_enabled: false,
  elevationOpacity: 0.6,
  coverageOpacity: 0.7,
  map_invalidate_counter: 0,
  fit_bounds_counter: 0,
  fit_bounds: null as [[number, number], [number, number]] | null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useMapStore = create<MapState>((set) => ({
  ...initialState,

  setViewport: (viewport) => set({ viewport }),

  setMode: (mode) => set({ mode }),

  invalidateMap: () => set((state) => ({ map_invalidate_counter: state.map_invalidate_counter + 1 })),

  requestFitBounds: (bounds) => set((state) => ({
    fit_bounds: bounds,
    fit_bounds_counter: state.fit_bounds_counter + 1,
  })),

  selectNode: (node_id) => set({
    selected_node_id: node_id,
    selected_node_ids: node_id ? [node_id] : [],
  }),

  toggleNodeSelection: (node_id) =>
    set((state) => {
      const ids = state.selected_node_ids.includes(node_id)
        ? state.selected_node_ids.filter((id) => id !== node_id)
        : [...state.selected_node_ids, node_id];
      return {
        selected_node_ids: ids,
        selected_node_id: ids.length > 0 ? ids[ids.length - 1] : null,
      };
    }),

  selectMultipleNodes: (node_ids) => set({
    selected_node_ids: node_ids,
    selected_node_id: node_ids.length > 0 ? node_ids[node_ids.length - 1] : null,
  }),

  clearNodeSelection: () => set({
    selected_node_id: null,
    selected_node_ids: [],
  }),

  hoverNode: (node_id) => set({ hovered_node_id: node_id }),

  toggleLayer: (layer) =>
    set((state) => ({
      layer_visibility: {
        ...state.layer_visibility,
        [layer]: !state.layer_visibility[layer],
      },
    })),

  setLayerVisibility: (visibility) =>
    set((state) => ({
      layer_visibility: {
        ...state.layer_visibility,
        ...visibility,
      },
    })),

  setTempNode: (coords) => set({ temp_node: coords }),

  setLOSOverlays: (overlays) => set({ los_overlays: overlays }),
  clearLOSOverlays: () => set({ los_overlays: [] }),
  setCoverageOverlays: (overlays) => set({ coverage_overlays: overlays }),
  clearCoverageOverlays: () => set({ coverage_overlays: [] }),
  setTerrainCoverageOverlays: (overlays) => set({ terrain_coverage_overlays: overlays }),
  clearTerrainCoverageOverlays: () => set({ terrain_coverage_overlays: [] }),
  setViewshedOverlays: (overlays) => set({ viewshed_overlays: overlays }),
  clearViewshedOverlays: () => set({ viewshed_overlays: [] }),
  setRoutePathOverlays: (overlays) => set({ route_path_overlays: overlays }),
  clearRoutePathOverlays: () => set({ route_path_overlays: [] }),
  setFloodingOverlay: (overlay) => set({ flooding_overlay: overlay }),
  updateFloodingWaveIndex: (index) => set((state) => ({
    flooding_overlay: state.flooding_overlay
      ? { ...state.flooding_overlay, currentWaveIndex: index }
      : null,
  })),
  setFloodingPlaying: (playing) => set((state) => ({
    flooding_overlay: state.flooding_overlay
      ? { ...state.flooding_overlay, isPlaying: playing }
      : null,
  })),
  clearFloodingOverlay: () => set({ flooding_overlay: null }),
  setPlacementSuggestions: (suggestions, coverageRadiusM) => set({
    placement_suggestions: suggestions,
    ...(coverageRadiusM != null ? { placement_coverage_radius_m: coverageRadiusM } : {}),
  }),
  clearPlacementSuggestions: () => set({ placement_suggestions: [], placement_search_bounds: null }),
  setPlacementSearchBounds: (bounds) => set({ placement_search_bounds: bounds }),
  clearPlacementSearchBounds: () => set({ placement_search_bounds: null }),
  setCoverageOpacity: (opacity) => set({ coverageOpacity: opacity }),
  setElevationLayerEnabled: (enabled) => set({ elevation_layer_enabled: enabled }),
  setElevationOpacity: (opacity) => set({ elevationOpacity: opacity }),
}));
