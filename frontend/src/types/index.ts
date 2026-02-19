/**
 * Core Type Definitions
 * Type system for Mesh Community Planner frontend
 */

// ============================================================================
// Core Domain Types
// ============================================================================

export type FirmwareFamily = 'meshtastic' | 'meshcore' | 'reticulum';
export type RegionCode = 'us_fcc' | 'eu_868' | 'eu_433' | 'anz';
export type CodingRate = '4/5' | '4/6' | '4/7' | '4/8';
export type UnitSystem = 'metric' | 'imperial';
export type ColorPalette = 'viridis' | 'cividis' | 'deuteranopia' | 'protanopia' | 'tritanopia' | 'high_contrast';

// ============================================================================
// Plan & Node Types
// ============================================================================

export interface Plan {
  id: string;
  name: string;
  description: string;
  firmware_family: FirmwareFamily | null;
  region: RegionCode | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Node {
  id: string | number;
  plan_id: string;
  name: string;
  latitude: number;
  longitude: number;
  antenna_height_m: number;
  elevation?: number;
  status?: 'online' | 'offline' | 'warning';
  device_id: string;
  firmware: FirmwareFamily;
  region: RegionCode;
  frequency_mhz: number;
  tx_power_dbm: number;
  spreading_factor: number;
  bandwidth_khz: number;
  coding_rate: CodingRate;
  modem_preset: string | null;
  antenna_id: string;
  cable_id: string | null;
  cable_length_m: number;
  pa_module_id: string | null;
  is_solar: boolean;
  desired_coverage_radius_m: number | null;
  notes: string;
  environment: string;  // 'los_elevated' | 'open_rural' | 'suburban' | 'urban' | 'indoor'
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Propagation Types (minimal for Phase 8)
// ============================================================================

export interface CoverageResult {
  engine: string;
  node_id: string | null;
  coverage_radius_m: number | null;
  signal_grid: number[][] | null;
  bounds: BoundingBox | null;
  timestamp: string;
}

export interface BoundingBox {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
}

// ============================================================================
// Topology Types (minimal for Phase 8)
// ============================================================================

export interface TopologyNode {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  is_critical: boolean;
  is_isolated: boolean;
  connectivity: number;
}

export interface TopologyEdge {
  source: string;
  target: string;
  quality: 'strong' | 'marginal' | 'weak';
  signal_strength_dbm: number | null;
}

export interface Link {
  id: number;
  source_node_id: number;
  target_node_id: number;
  link_quality?: number;
  signal_strength_dbm?: number | null;
  status?: 'active' | 'inactive' | 'degraded';
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface ResilienceMetrics {
  total_nodes: number;
  total_links: number;
  avg_connectivity: number;
  spof_count: number;
  network_diameter: number;
  is_connected: boolean;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface Settings {
  unit_system: UnitSystem;
  color_palette: ColorPalette;
  map_cache_limit_mb: number;
  terrain_cache_limit_mb: number;
  total_cache_limit_mb: number;
  sun_hours_peak: number;
  battery_autonomy_days: number;
  signal_server_concurrency: number;
}

// ============================================================================
// Map State Types
// ============================================================================

export type MapMode = 'view' | 'add_node' | 'edit_node' | 'measure';

export interface MapViewport {
  center: [number, number];
  zoom: number;
}

export interface LayerVisibility {
  coverage_circles: boolean;
  heatmaps: boolean;
  connectivity_lines: boolean;
  overlap_zones: boolean;
  planning_radius: boolean;
  node_labels: boolean;
}
