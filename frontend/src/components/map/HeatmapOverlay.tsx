/**
 * HeatmapOverlay component
 * Visualizes propagation signal strength as a heatmap
 * Uses Leaflet.heat plugin for efficient rendering
 */

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Extend Leaflet types for heat layer
declare module 'leaflet' {
  interface HeatLayerOptions {
    radius?: number;
    blur?: number;
    maxZoom?: number;
    gradient?: Record<string, string>;
  }

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: [number, number, number][]): this;
  }

  function heatLayer(
    latlngs: [number, number, number][],
    options?: HeatLayerOptions
  ): HeatLayer;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export interface HeatmapOverlayProps {
  data: HeatmapPoint[];
  visible: boolean;
  radius?: number;
  blur?: number;
  maxZoom?: number;
  gradient?: Record<string, string>;
  className?: string;
}

/**
 * Default gradient: blue (weak) -> yellow (medium) -> red (strong)
 */
const DEFAULT_GRADIENT = {
  0.0: 'blue',
  0.4: 'cyan',
  0.6: 'lime',
  0.8: 'yellow',
  1.0: 'red',
};

/**
 * Normalize intensity values to 0-1 range
 */
function normalizeData(data: HeatmapPoint[]): [number, number, number][] {
  // Filter out invalid points
  const validData = data.filter(
    (point) =>
      !isNaN(point.lat) &&
      !isNaN(point.lng) &&
      !isNaN(point.intensity) &&
      point.intensity >= 0
  );

  if (validData.length === 0) return [];

  // Find max intensity for normalization
  const maxIntensity = Math.max(...validData.map((p) => p.intensity));

  // Convert to [lat, lng, intensity] format expected by Leaflet.heat
  return validData.map((point) => [
    point.lat,
    point.lng,
    maxIntensity > 0 ? point.intensity / maxIntensity : 0,
  ]);
}

export function HeatmapOverlay({
  data,
  visible,
  radius = 25,
  blur = 15,
  maxZoom = 17,
  gradient = DEFAULT_GRADIENT,
  className = '',
}: HeatmapOverlayProps) {
  const map = useMap();
  const heatLayerRef = useRef<L.HeatLayer | null>(null);

  useEffect(() => {
    // Don't render if not visible or no data
    if (!visible || data.length === 0) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      return;
    }

    // Normalize and filter data
    const normalizedData = normalizeData(data);

    if (normalizedData.length === 0) {
      return;
    }

    // Create or update heat layer
    if (!heatLayerRef.current) {
      heatLayerRef.current = L.heatLayer(normalizedData, {
        radius,
        blur,
        maxZoom,
        gradient,
      }).addTo(map);
    } else {
      heatLayerRef.current.setLatLngs(normalizedData);
    }

    // Cleanup on unmount
    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [data, visible, radius, blur, maxZoom, gradient, map]);

  // Only render description when visible and has data
  if (!visible || data.length === 0) {
    return null;
  }

  // Render hidden description for screen readers
  return (
    <div className={`sr-only ${className}`} aria-live="polite">
      Signal strength heatmap showing {data.length} data points
    </div>
  );
}
