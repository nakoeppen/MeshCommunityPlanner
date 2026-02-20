/**
 * MapContainer component
 * Main map component with Leaflet integration, OSM tiles, node markers,
 * multi-select, group drag, click-to-add toggle, and dynamic analysis overlays
 */

import { useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { usePlanStore } from '../../stores/planStore';
import { useMapStore } from '../../stores/mapStore';
import type { TerrainCoverageOverlay, ViewshedOverlay, RoutePathOverlay, FloodingOverlay, PlacementSuggestion } from '../../stores/mapStore';
import { CoverageLegend } from './CoverageLegend';
import { ElevationLegend } from './ElevationLegend';
import { getAPIClient } from '../../services/api';

// Inline SVG marker icons - no external images needed
function createNodeIcon(selected: boolean = false, multiSelected: boolean = false) {
  let color = '#3498db'; // default blue
  if (selected) {
    color = '#e74c3c'; // red for primary selected
  } else if (multiSelected) {
    color = '#e67e22'; // orange for multi-selected
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle cx="14" cy="14" r="6" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'custom-marker-icon',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
}

// Stable default center - defined outside component to avoid re-creation
const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

export interface MapContainerProps {
  className?: string;
}

export function MapContainer({ className = '' }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const losLayerRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerRef = useRef<L.LayerGroup | null>(null);
  const terrainCoverageLayerRef = useRef<L.LayerGroup | null>(null);
  const viewshedLayerRef = useRef<L.LayerGroup | null>(null);
  const routePathLayerRef = useRef<L.LayerGroup | null>(null);
  const floodingLayerRef = useRef<L.LayerGroup | null>(null);
  const placementLayerRef = useRef<L.LayerGroup | null>(null);
  const elevationTileLayerRef = useRef<L.TileLayer | null>(null);
  const elevationEnsureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPosRef = useRef<L.LatLng | null>(null);

  // Read store values
  const nodes = usePlanStore((s) => s.nodes);
  const addNode = usePlanStore((s) => s.addNode);
  const updateNodeStore = usePlanStore((s) => s.updateNode);
  const selectedNodeId = useMapStore((s) => s.selected_node_id);
  const selectedNodeIds = useMapStore((s) => s.selected_node_ids);
  const selectNode = useMapStore((s) => s.selectNode);
  const toggleNodeSelection = useMapStore((s) => s.toggleNodeSelection);
  const losOverlays = useMapStore((s) => s.los_overlays);
  const coverageOverlays = useMapStore((s) => s.coverage_overlays);
  const terrainCoverageOverlays = useMapStore((s) => s.terrain_coverage_overlays);
  const viewshedOverlays = useMapStore((s) => s.viewshed_overlays);
  const routePathOverlays = useMapStore((s) => s.route_path_overlays);
  const floodingOverlay = useMapStore((s) => s.flooding_overlay);
  const placementSuggestions = useMapStore((s) => s.placement_suggestions);
  const placementCoverageRadiusM = useMapStore((s) => s.placement_coverage_radius_m);
  const placementSearchBounds = useMapStore((s) => s.placement_search_bounds);
  const coverageOpacity = useMapStore((s) => s.coverageOpacity);
  const elevationLayerEnabled = useMapStore((s) => s.elevation_layer_enabled);
  const elevationOpacity = useMapStore((s) => s.elevationOpacity);
  const mapInvalidateCounter = useMapStore((s) => s.map_invalidate_counter);
  const fitBoundsCounter = useMapStore((s) => s.fit_bounds_counter);
  const fitBounds = useMapStore((s) => s.fit_bounds);

  // Handle map clicks for adding nodes (reads current network radio settings)
  const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
    const plan = usePlanStore.getState().current_plan;
    const mode = useMapStore.getState().mode;

    if (mode !== 'add_node' || !plan) return;

    const { lat, lng } = e.latlng;
    const currentNodes = usePlanStore.getState().nodes;
    const nodeNum = currentNodes.length + 1;

    // Inherit radio settings from existing nodes (network-wide consistency)
    const refNode = currentNodes.length > 0 ? currentNodes[0] : null;
    const firmware = refNode?.firmware || 'meshtastic';
    const region = refNode?.region || plan.region || 'us_fcc';
    const frequency = refNode?.frequency_mhz || 906.875;
    const sf = refNode?.spreading_factor || 11;
    const bw = refNode?.bandwidth_khz || 250;
    const cr = refNode?.coding_rate || '4/5';

    const api = getAPIClient();
    try {
      const newNode = await api.createNode(plan.id, {
        name: `Node ${nodeNum}`,
        latitude: lat,
        longitude: lng,
        antenna_height_m: 3,
        device_id: 'tbeam-supreme',
        firmware,
        region,
        frequency_mhz: frequency,
        tx_power_dbm: 20,
        spreading_factor: sf,
        bandwidth_khz: bw,
        coding_rate: cr,
        modem_preset: null,
        antenna_id: '915-3dbi-omni',
        cable_id: null,
        cable_length_m: 0,
        pa_module_id: null,
        is_solar: false,
        desired_coverage_radius_m: null,
        notes: '',
      });
      addNode(newNode);
    } catch (err: any) {
      console.error('Failed to create node:', err);
      addNode({
        id: `temp-${Date.now()}`,
        plan_id: plan.id,
        name: `Node ${nodeNum}`,
        latitude: lat,
        longitude: lng,
        antenna_height_m: 3,
        device_id: 'tbeam-supreme',
        firmware,
        region,
        frequency_mhz: frequency,
        tx_power_dbm: 20,
        spreading_factor: sf,
        bandwidth_khz: bw,
        coding_rate: cr,
        modem_preset: null,
        antenna_id: '915-3dbi-omni',
        cable_id: null,
        cable_length_m: 0,
        pa_module_id: null,
        is_solar: false,
        desired_coverage_radius_m: null,
        notes: '',
        sort_order: nodeNum,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [addNode]);

  // Handle marker drag start - record initial position for group drag
  const handleMarkerDragStart = useCallback((_nodeId: string, e: L.LeafletEvent) => {
    const marker = e.target as L.Marker;
    dragStartPosRef.current = marker.getLatLng();
  }, []);

  // Handle marker drag end - GROUP DRAG: update ALL selected node positions locally first, then API
  const handleMarkerDragEnd = useCallback(async (nodeId: string, e: L.DragEndEvent) => {
    const latlng = (e.target as L.Marker).getLatLng();
    const plan = usePlanStore.getState().current_plan;
    const currentSelectedIds = useMapStore.getState().selected_node_ids;
    const startPos = dragStartPosRef.current;
    dragStartPosRef.current = null;

    // Collect all position updates
    const updates: Array<{ id: string; lat: number; lng: number }> = [];

    if (startPos && currentSelectedIds.length > 1 && currentSelectedIds.includes(nodeId)) {
      // GROUP DRAG: compute delta and apply to all selected nodes
      const deltaLat = latlng.lat - startPos.lat;
      const deltaLng = latlng.lng - startPos.lng;

      // Phase 1: Update ALL local store positions immediately (no awaits)
      for (const id of currentSelectedIds) {
        if (id === nodeId) {
          updateNodeStore(nodeId, { latitude: latlng.lat, longitude: latlng.lng });
          updates.push({ id: nodeId, lat: latlng.lat, lng: latlng.lng });
        } else {
          const otherNode = usePlanStore.getState().nodes.find((n) => String(n.id) === id);
          if (otherNode) {
            const newLat = otherNode.latitude + deltaLat;
            const newLng = otherNode.longitude + deltaLng;
            updateNodeStore(id, { latitude: newLat, longitude: newLng });
            updates.push({ id, lat: newLat, lng: newLng });
          }
        }
      }
    } else {
      // SINGLE drag
      updateNodeStore(nodeId, { latitude: latlng.lat, longitude: latlng.lng });
      updates.push({ id: nodeId, lat: latlng.lat, lng: latlng.lng });
    }

    // Phase 2: Persist all to API in parallel (non-blocking)
    if (plan) {
      const api = getAPIClient();
      for (const u of updates) {
        if (!u.id.startsWith('temp-')) {
          api.updateNode(plan.id, u.id, { latitude: u.lat, longitude: u.lng })
            .catch((err: any) => console.error('Failed to persist node position:', err));
        }
      }
    }
  }, [updateNodeStore]);

  // Initialize map (once)
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    const losLayer = L.layerGroup().addTo(map);
    losLayerRef.current = losLayer;

    const coverageLayer = L.layerGroup().addTo(map);
    coverageLayerRef.current = coverageLayer;

    const terrainCoverageLayer = L.layerGroup().addTo(map);
    terrainCoverageLayerRef.current = terrainCoverageLayer;

    const viewshedLayer = L.layerGroup().addTo(map);
    viewshedLayerRef.current = viewshedLayer;

    const routePathLayer = L.layerGroup().addTo(map);
    routePathLayerRef.current = routePathLayer;

    const floodingLayer = L.layerGroup().addTo(map);
    floodingLayerRef.current = floodingLayer;

    const placementLayer = L.layerGroup().addTo(map);
    placementLayerRef.current = placementLayer;

    map.on('click', handleMapClick);

    leafletMapRef.current = map;

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Fix 1: Invalidate map size when sidebar toggles
  useEffect(() => {
    if (mapInvalidateCounter === 0) return;
    leafletMapRef.current?.invalidateSize();
  }, [mapInvalidateCounter]);

  // Fix 3: Fit bounds when a plan is loaded
  useEffect(() => {
    if (fitBoundsCounter === 0 || !fitBounds || !leafletMapRef.current) return;
    const [[swLat, swLng], [neLat, neLng]] = fitBounds;
    if (swLat === neLat && swLng === neLng) {
      // Single node — center on it
      leafletMapRef.current.setView([swLat, swLng], 14);
    } else {
      leafletMapRef.current.fitBounds([[swLat, swLng], [neLat, neLng]], { padding: [50, 50], maxZoom: 15 });
    }
  }, [fitBoundsCounter, fitBounds]);

  // Update markers when nodes or selection changes
  useEffect(() => {
    if (!markersLayerRef.current || !leafletMapRef.current) return;

    const currentMarkerIds = new Set(markersRef.current.keys());
    const newNodeIds = new Set(nodes.map((n) => String(n.id)));

    // Remove markers for deleted nodes
    currentMarkerIds.forEach((id) => {
      if (!newNodeIds.has(id)) {
        const marker = markersRef.current.get(id);
        if (marker) {
          markersLayerRef.current!.removeLayer(marker);
          markersRef.current.delete(id);
        }
      }
    });

    // Add or update markers for each node
    nodes.forEach((node) => {
      const nodeId = String(node.id);
      const isPrimarySelected = selectedNodeId === nodeId;
      const isMultiSelected = selectedNodeIds.includes(nodeId);
      const existingMarker = markersRef.current.get(nodeId);

      if (existingMarker) {
        existingMarker.setLatLng([node.latitude, node.longitude]);
        existingMarker.setIcon(createNodeIcon(isPrimarySelected, isMultiSelected && !isPrimarySelected));
        existingMarker.setPopupContent(
          `<b>${node.name}</b><br>` +
          `Lat: ${node.latitude.toFixed(5)}<br>` +
          `Lon: ${node.longitude.toFixed(5)}<br>` +
          `Height: ${node.antenna_height_m}m<br>` +
          `Device: ${node.device_id}<br>` +
          `Power: ${node.tx_power_dbm} dBm`
        );
        // Update permanent label — must unbind/rebind to change options
        existingMarker.unbindTooltip();
        existingMarker.bindTooltip(node.name, { permanent: true, direction: 'top', offset: [0, -42], className: 'node-label-tooltip' });
      } else {
        const marker = L.marker([node.latitude, node.longitude], {
          icon: createNodeIcon(isPrimarySelected, isMultiSelected && !isPrimarySelected),
          draggable: true,
        })
          .bindPopup(
            `<b>${node.name}</b><br>` +
            `Lat: ${node.latitude.toFixed(5)}<br>` +
            `Lon: ${node.longitude.toFixed(5)}<br>` +
            `Height: ${node.antenna_height_m}m<br>` +
            `Device: ${node.device_id}<br>` +
            `Power: ${node.tx_power_dbm} dBm`
          )
          .bindTooltip(node.name, { permanent: true, direction: 'top', offset: [0, -42], className: 'node-label-tooltip' });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const originalEvent = (e as any).originalEvent as MouseEvent;
          if (originalEvent && (originalEvent.ctrlKey || originalEvent.metaKey)) {
            toggleNodeSelection(nodeId);
          } else {
            // If this node is already in a multi-selection, just make it primary
            const currentIds = useMapStore.getState().selected_node_ids;
            if (currentIds.includes(nodeId) && currentIds.length > 1) {
              useMapStore.setState({ selected_node_id: nodeId });
            } else {
              selectNode(nodeId);
            }
          }
        });

        marker.on('dragstart', (e) => handleMarkerDragStart(nodeId, e));
        marker.on('dragend', (e) => handleMarkerDragEnd(nodeId, e));

        markersLayerRef.current!.addLayer(marker);
        markersRef.current.set(nodeId, marker);
      }
    });
  }, [nodes, selectedNodeId, selectedNodeIds, selectNode, toggleNodeSelection, handleMarkerDragStart, handleMarkerDragEnd]);

  // Build popup HTML for a LOS overlay
  const buildLOSPopupHtml = useCallback((los: typeof losOverlays[number]) => {
    const qualityLabel = !los.isViable
      ? 'Not Viable'
      : !los.hasLos
        ? 'NLOS (Obstructed)'
        : los.linkQuality === 'marginal'
          ? 'Marginal'
          : 'Good';

    const terrainLines: string[] = [];
    if (!los.hasLos) {
      terrainLines.push(`<b style="color:#f97316">Terrain Obstructed</b>`);
      if (los.maxObstructionM > 0) {
        terrainLines.push(`Obstruction: ${los.maxObstructionM.toFixed(1)}m above LOS`);
      }
      if (los.additionalLossDb > 0) {
        terrainLines.push(`Diffraction Loss: ${los.additionalLossDb.toFixed(1)} dB`);
      }
    } else {
      terrainLines.push(`<b style="color:#16a34a">Clear Line of Sight</b>`);
    }
    if (los.totalPathLossDb > 0) {
      const fspl = los.freeSpaceLossDb > 0 ? ` (FSPL: ${los.freeSpaceLossDb.toFixed(1)})` : '';
      terrainLines.push(`Path Loss: ${los.totalPathLossDb.toFixed(1)} dB${fspl}`);
    }

    const elevSrc = los.elevationSource || 'flat_terrain';
    const elevLabel = elevSrc === 'srtm_30m' ? 'SRTM 30m'
      : elevSrc === 'srtm_partial' ? 'SRTM (partial)'
      : elevSrc === 'srtm_no_data' ? 'SRTM (no data)'
      : 'Flat terrain';
    const elevColor = elevSrc.startsWith('srtm') && elevSrc !== 'srtm_no_data' ? '#16a34a' : '#f97316';
    const elevRange = los.elevationMaxM > 0
      ? ` (${los.elevationMinM.toFixed(0)}-${los.elevationMaxM.toFixed(0)}m)`
      : '';

    return (
      `<b>Link: ${los.nodeAName} <-> ${los.nodeBName}</b><br>` +
      `Quality: ${qualityLabel}<br>` +
      `Distance: ${(los.distanceM / 1000).toFixed(2)} km<br>` +
      terrainLines.join('<br>') + '<br>' +
      `Fresnel Clearance: ${los.fresnelClearancePct.toFixed(0)}%<br>` +
      `Link Margin: ${los.linkMarginDb.toFixed(1)} dB<br>` +
      `Rx Signal: ${los.receivedSignalDbm.toFixed(1)} dBm<br>` +
      `<span style="color:${elevColor}">Terrain: ${elevLabel}${elevRange}</span>`
    );
  }, []);

  // Draw LOS overlays - DYNAMIC: look up current node positions from nodes array
  // Fix 5: invisible hit lines for wider click area
  // Fix 6: disambiguation popup when multiple lines overlap
  useEffect(() => {
    if (!losLayerRef.current || !leafletMapRef.current) return;
    losLayerRef.current.clearLayers();

    const map = leafletMapRef.current;

    // Store hit lines + LOS data for disambiguation
    const hitLines: Array<{ line: L.Polyline; los: typeof losOverlays[number]; visibleLine: L.Polyline }> = [];

    losOverlays.forEach((los) => {
      const nodeA = nodes.find((n) => String(n.id) === los.nodeAUuid);
      const nodeB = nodes.find((n) => String(n.id) === los.nodeBUuid);
      if (!nodeA || !nodeB) return;

      let color = '#16a34a';
      let dashArray = '';
      let weight = 3;
      if (!los.isViable) {
        color = '#dc2626';
        dashArray = '10, 5';
        weight = 3;
      } else if (!los.hasLos) {
        color = '#f97316';
        dashArray = '8, 4';
        weight = 3;
      } else if (los.linkQuality === 'marginal') {
        color = '#eab308';
        dashArray = '5, 5';
      }

      const coords: L.LatLngExpression[] = [[nodeA.latitude, nodeA.longitude], [nodeB.latitude, nodeB.longitude]];

      // Invisible wide hit-detection line (Fix 5)
      const hitLine = L.polyline(coords, { weight: 16, opacity: 0, interactive: true });

      // Visible styled line on top
      const visibleLine = L.polyline(coords, { color, weight, opacity: 0.8, dashArray, interactive: false });

      const qualityLabel = !los.isViable ? 'Not Viable' : !los.hasLos ? 'NLOS (Obstructed)' : los.linkQuality === 'marginal' ? 'Marginal' : 'Good';
      const losTag = los.hasLos ? '' : ' NLOS';
      visibleLine.bindTooltip(`${qualityLabel}${losTag} (${(los.distanceM / 1000).toFixed(1)}km)`);
      hitLine.bindTooltip(`${qualityLabel}${losTag} (${(los.distanceM / 1000).toFixed(1)}km)`);

      hitLines.push({ line: hitLine, los, visibleLine });

      losLayerRef.current!.addLayer(hitLine);
      losLayerRef.current!.addLayer(visibleLine);
    });

    // Fix 6: Disambiguation — on hit line click, check for nearby overlapping lines
    const distToSegment = (pt: L.Point, a: L.Point, b: L.Point): number => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return pt.distanceTo(a);
      let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const proj = L.point(a.x + t * dx, a.y + t * dy);
      return pt.distanceTo(proj);
    };

    hitLines.forEach(({ line, los }) => {
      line.on('click', (e: L.LeafletMouseEvent) => {
        const clickPt = map.latLngToLayerPoint(e.latlng);

        // Find all lines within 20px of the click point
        const nearby = hitLines.filter(({ los: otherLos }) => {
          const nA = nodes.find((n) => String(n.id) === otherLos.nodeAUuid);
          const nB = nodes.find((n) => String(n.id) === otherLos.nodeBUuid);
          if (!nA || !nB) return false;
          const ptA = map.latLngToLayerPoint(L.latLng(nA.latitude, nA.longitude));
          const ptB = map.latLngToLayerPoint(L.latLng(nB.latitude, nB.longitude));
          return distToSegment(clickPt, ptA, ptB) <= 20;
        });

        if (nearby.length <= 1) {
          // Single match — open detail popup directly on the line
          L.popup().setLatLng(e.latlng).setContent(buildLOSPopupHtml(los)).openOn(map);
        } else {
          // Multiple matches — disambiguation popup
          const items = nearby.map(({ los: nLos }) => {
            const q = !nLos.isViable ? 'Not Viable' : !nLos.hasLos ? 'NLOS' : nLos.linkQuality === 'marginal' ? 'Marginal' : 'Good';
            const dist = (nLos.distanceM / 1000).toFixed(2);
            return `<div class="los-disambig-item" data-los-id="${nLos.id}" style="cursor:pointer;padding:3px 6px;border-bottom:1px solid #555;">` +
              `<b>${nLos.nodeAName} ↔ ${nLos.nodeBName}</b> — ${q}, ${dist} km</div>`;
          }).join('');

          const popup = L.popup({ className: 'los-disambig-popup', maxWidth: 320 })
            .setLatLng(e.latlng)
            .setContent(`<div class="los-disambig"><div class="los-disambig-title">Multiple links at this point:</div>${items}</div>`)
            .openOn(map);

          // Bind click handlers on disambiguation items
          setTimeout(() => {
            const container = popup.getElement();
            if (!container) return;
            container.querySelectorAll('.los-disambig-item').forEach((el) => {
              el.addEventListener('click', () => {
                const losId = (el as HTMLElement).dataset.losId;
                const match = nearby.find(({ los: nLos }) => nLos.id === losId);
                if (match) {
                  L.popup().setLatLng(e.latlng).setContent(buildLOSPopupHtml(match.los)).openOn(map);
                }
              });
            });
          }, 50);
        }
      });
    });
  }, [losOverlays, nodes, buildLOSPopupHtml]); // depends on NODES so lines update when nodes move

  // Draw coverage overlays - DYNAMIC: look up current node positions
  useEffect(() => {
    if (!coverageLayerRef.current) return;
    coverageLayerRef.current.clearLayers();

    coverageOverlays.forEach((cov) => {
      // Look up current position from nodes array
      const node = nodes.find((n) => String(n.id) === cov.nodeUuid);
      if (!node) return; // skip if deleted

      const circle = L.circle([node.latitude, node.longitude], {
        radius: cov.coverageRadiusM,
        color: '#3498db',
        fillColor: '#3498db',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '5, 5',
      });

      circle.bindPopup(
        `<b>Coverage: ${cov.nodeName}</b><br>` +
        `Radius: ${(cov.coverageRadiusM / 1000).toFixed(2)} km<br>` +
        `Engine: ${cov.engine}`
      );

      circle.bindTooltip(`${(cov.coverageRadiusM / 1000).toFixed(1)}km radius`);
      coverageLayerRef.current!.addLayer(circle);
    });
  }, [coverageOverlays, nodes]); // depends on NODES so circles follow nodes

  // Draw terrain coverage heat map overlays (L.imageOverlay)
  useEffect(() => {
    if (!terrainCoverageLayerRef.current) return;
    terrainCoverageLayerRef.current.clearLayers();

    terrainCoverageOverlays.forEach((overlay: TerrainCoverageOverlay) => {
      if (!overlay.imageDataUrl) return;

      const imageBounds: L.LatLngBoundsExpression = [
        [overlay.bounds.min_lat, overlay.bounds.min_lon],
        [overlay.bounds.max_lat, overlay.bounds.max_lon],
      ];

      const imageOverlay = L.imageOverlay(overlay.imageDataUrl, imageBounds, {
        opacity: coverageOpacity,
        interactive: true,
      });

      // Compute signal statistics for enhanced popup
      const signals = overlay.points.map((p) => p.signal_dbm);
      let popupContent = `<b>Coverage: ${overlay.nodeName}</b><br>` +
        `Environment: ${overlay.environment}<br>`;
      if (signals.length > 0) {
        const minSignal = Math.min(...signals);
        const maxSignal = Math.max(...signals);
        const avgSignal = (signals.reduce((a, b) => a + b, 0) / signals.length).toFixed(1);
        popupContent +=
          `Signal range: ${maxSignal.toFixed(0)} to ${minSignal.toFixed(0)} dBm<br>` +
          `Average: ${avgSignal} dBm<br>`;
      }
      popupContent +=
        `Grid points: ${overlay.points.length.toLocaleString()}<br>` +
        `Elevation: ${overlay.elevationSource}<br>` +
        `Compute: ${overlay.computationTimeMs}ms`;

      imageOverlay.bindPopup(popupContent);

      terrainCoverageLayerRef.current!.addLayer(imageOverlay);
    });
  }, [terrainCoverageOverlays, coverageOpacity]);

  // Draw viewshed overlays — green solid for visible, red dashed for blocked
  useEffect(() => {
    if (!viewshedLayerRef.current) return;
    viewshedLayerRef.current.clearLayers();

    viewshedOverlays.forEach((vs: ViewshedOverlay) => {
      const observer = nodes.find((n) => String(n.id) === vs.observerUuid);
      if (!observer) return;

      vs.results.forEach((target) => {
        const targetNode = nodes.find((n) => String(n.id) === target.nodeId);
        const lat = targetNode?.latitude ?? target.latitude;
        const lon = targetNode?.longitude ?? target.longitude;

        const coords: L.LatLngExpression[] = [
          [observer.latitude, observer.longitude],
          [lat, lon],
        ];

        const color = target.hasLos ? '#16a34a' : '#dc2626';
        const dashArray = target.hasLos ? '' : '10, 5';

        const line = L.polyline(coords, {
          color,
          weight: 2,
          opacity: 0.7,
          dashArray,
          interactive: true,
        });

        const statusLabel = target.hasLos ? 'Visible' : 'Blocked';
        const distKm = (target.distanceM / 1000).toFixed(2);
        const obstructionHtml = target.maxObstructionM != null && target.maxObstructionM > 0
          ? `<br>Obstruction: ${target.maxObstructionM.toFixed(1)}m above LOS` : '';
        const terrainTag = vs.terrainAvailable ? 'SRTM terrain' : 'Flat terrain';

        line.bindPopup(
          `<b>Viewshed: ${vs.observerName} → ${target.nodeName}</b><br>` +
          `Status: <b>${statusLabel}</b><br>` +
          `Distance: ${distKm} km${obstructionHtml}<br>` +
          `Terrain: ${terrainTag}`
        );

        line.bindTooltip(`${target.nodeName}: ${statusLabel} (${distKm}km)`);
        viewshedLayerRef.current!.addLayer(line);
      });
    });
  }, [viewshedOverlays, nodes]);

  // Draw route path overlays — cyan bold for primary, dashed for alternatives
  useEffect(() => {
    if (!routePathLayerRef.current) return;
    routePathLayerRef.current.clearLayers();

    routePathOverlays.forEach((route: RoutePathOverlay) => {
      const isPrimary = route.rank === 0;
      const pathCoords: L.LatLngExpression[] = [];

      for (const uuid of route.path) {
        const node = nodes.find((n) => String(n.id) === uuid);
        if (node) pathCoords.push([node.latitude, node.longitude]);
      }

      if (pathCoords.length < 2) return;

      const line = L.polyline(pathCoords, {
        color: '#06b6d4',
        weight: isPrimary ? 5 : 3,
        opacity: isPrimary ? 0.9 : 0.5,
        dashArray: isPrimary ? '' : '8, 6',
        interactive: true,
      });

      if (isPrimary) {
        const hopDetails = route.pathLinks.map((link) => {
          const nA = nodes.find((n) => String(n.id) === link.nodeAUuid);
          const nB = nodes.find((n) => String(n.id) === link.nodeBUuid);
          return `${nA?.name || '?'} → ${nB?.name || '?'}: ${(link.distanceM / 1000).toFixed(2)} km (${link.linkQuality})`;
        }).join('<br>');

        line.bindPopup(
          `<b>Route: ${route.sourceName} → ${route.targetName}</b><br>` +
          `Hops: ${route.hopCount}<br>` +
          `Total distance: ${(route.totalDistanceM / 1000).toFixed(2)} km<br>` +
          `<hr style="margin:4px 0">${hopDetails}`
        );
      } else {
        line.bindPopup(
          `<b>Alternative route #${route.rank}</b><br>` +
          `${route.sourceName} → ${route.targetName}<br>` +
          `Hops: ${route.hopCount}, Distance: ${(route.totalDistanceM / 1000).toFixed(2)} km`
        );
      }

      const label = isPrimary ? 'Primary' : `Alt #${route.rank}`;
      line.bindTooltip(`${label}: ${route.hopCount} hops, ${(route.totalDistanceM / 1000).toFixed(1)}km`);
      routePathLayerRef.current!.addLayer(line);
    });
  }, [routePathOverlays, nodes]);

  // Draw flooding simulation overlay — animated wave expansion with critical node/bridge highlighting
  useEffect(() => {
    if (!floodingLayerRef.current) return;
    floodingLayerRef.current.clearLayers();

    if (!floodingOverlay) return;

    const waveColors = ['#2ecc71', '#27ae60', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6'];
    const criticalSet = new Set(floodingOverlay.criticalNodeIds || []);
    const bridgeSet = new Set(
      (floodingOverlay.bridgeLinks || []).map((b) => [b.from, b.to].sort().join('-')),
    );

    // Draw waves up to currentWaveIndex
    for (let i = 0; i <= floodingOverlay.currentWaveIndex && i < floodingOverlay.waves.length; i++) {
      const wave = floodingOverlay.waves[i];
      const color = waveColors[Math.min(i, waveColors.length - 1)];
      const isCurrentWave = i === floodingOverlay.currentWaveIndex;

      // Draw links for this wave
      for (const link of wave.links) {
        const fromNode = nodes.find((n) => String(n.id) === link.from);
        const toNode = nodes.find((n) => String(n.id) === link.to);
        if (!fromNode || !toNode) continue;

        const linkKey = [link.from, link.to].sort().join('-');
        const isBridge = bridgeSet.has(linkKey);

        const line = L.polyline(
          [[fromNode.latitude, fromNode.longitude], [toNode.latitude, toNode.longitude]],
          {
            color: isBridge ? '#e74c3c' : color,
            weight: isCurrentWave ? 5 : (isBridge ? 4 : 3),
            opacity: isCurrentWave ? 1.0 : 0.7,
            dashArray: isBridge ? '8, 4' : (isCurrentWave ? '6, 4' : ''),
          }
        );
        const bridgeTag = isBridge ? ' [BRIDGE]' : '';
        line.bindTooltip(`Hop ${i}: ${(link.distanceM / 1000).toFixed(2)} km${bridgeTag}`);
        floodingLayerRef.current!.addLayer(line);
      }

      // Draw node circles for this wave
      for (const nodeId of wave.nodeIds) {
        const node = nodes.find((n) => String(n.id) === nodeId);
        if (!node) continue;

        const isSource = i === 0;
        const isCritical = criticalSet.has(nodeId);
        const radius = isSource ? 12 : 8;
        const circle = L.circleMarker([node.latitude, node.longitude], {
          radius,
          color,
          fillColor: color,
          fillOpacity: isSource ? 0.9 : 0.6,
          weight: isSource ? 3 : 2,
        });
        circle.bindTooltip(`${node.name} (Hop ${i}, ${wave.cumulativeTimeMs.toFixed(0)}ms)${isCritical ? ' [CRITICAL]' : ''}`);
        floodingLayerRef.current!.addLayer(circle);

        // Red dashed ring around critical (articulation point) nodes
        if (isCritical) {
          const ring = L.circleMarker([node.latitude, node.longitude], {
            radius: radius + 6,
            color: '#e74c3c',
            fillColor: 'transparent',
            fillOpacity: 0,
            weight: 2,
            dashArray: '4, 3',
            interactive: false,
          });
          floodingLayerRef.current!.addLayer(ring);
        }
      }
    }
  }, [floodingOverlay, nodes]);

  // Flooding animation timer — advance wave index when playing (speed-aware)
  useEffect(() => {
    if (!floodingOverlay?.isPlaying) return;
    const maxWave = floodingOverlay.waves.length - 1;
    if (floodingOverlay.currentWaveIndex >= maxWave) {
      useMapStore.getState().setFloodingPlaying(false);
      return;
    }
    const speedMs = floodingOverlay.animationSpeedMs ?? 800;
    const timer = setInterval(() => {
      const overlay = useMapStore.getState().flooding_overlay;
      if (!overlay || !overlay.isPlaying) return;
      const next = overlay.currentWaveIndex + 1;
      if (next > maxWave) {
        useMapStore.getState().setFloodingPlaying(false);
      } else {
        useMapStore.getState().updateFloodingWaveIndex(next);
      }
    }, speedMs);
    return () => clearInterval(timer);
  }, [floodingOverlay?.isPlaying, floodingOverlay?.waves.length, floodingOverlay?.animationSpeedMs]);

  // Elevation heatmap tile layer — create/destroy when toggled, update opacity
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (elevationLayerEnabled) {
      if (!elevationTileLayerRef.current) {
        const authToken = (window as any).__MESH_PLANNER_AUTH__ || '';
        const tileLayer = L.tileLayer(
          `/api/elevation/tile/{z}/{x}/{y}.png?token=${encodeURIComponent(authToken)}`,
          {
            minZoom: 9,
            maxZoom: 15,
            opacity: elevationOpacity,
            errorTileUrl: '',  // suppress broken tile images
          }
        );
        tileLayer.addTo(map);
        elevationTileLayerRef.current = tileLayer;

        // Ensure SRTM tiles are available for the visible area, then redraw
        const ensureAndRedraw = () => {
          if (elevationEnsureTimerRef.current) clearTimeout(elevationEnsureTimerRef.current);
          elevationEnsureTimerRef.current = setTimeout(async () => {
            const bounds = map.getBounds();
            try {
              await fetch('/api/elevation/ensure-tiles', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  min_lat: bounds.getSouth(),
                  min_lon: bounds.getWest(),
                  max_lat: bounds.getNorth(),
                  max_lon: bounds.getEast(),
                }),
              });
              elevationTileLayerRef.current?.redraw();
            } catch (err) {
              console.warn('Failed to ensure elevation tiles:', err);
            }
          }, 500);
        };

        map.on('moveend', ensureAndRedraw);
        // Store handler for cleanup
        (tileLayer as any)._ensureHandler = ensureAndRedraw;

        // Initial ensure for current view
        ensureAndRedraw();
      }
    } else {
      if (elevationTileLayerRef.current) {
        const handler = (elevationTileLayerRef.current as any)._ensureHandler;
        if (handler) leafletMapRef.current?.off('moveend', handler);
        leafletMapRef.current?.removeLayer(elevationTileLayerRef.current);
        elevationTileLayerRef.current = null;
      }
      if (elevationEnsureTimerRef.current) {
        clearTimeout(elevationEnsureTimerRef.current);
        elevationEnsureTimerRef.current = null;
      }
    }
  }, [elevationLayerEnabled]);

  // Update elevation tile layer opacity
  useEffect(() => {
    if (elevationTileLayerRef.current) {
      elevationTileLayerRef.current.setOpacity(elevationOpacity);
    }
  }, [elevationOpacity]);

  // Draw placement suggestion ghost markers
  useEffect(() => {
    if (!placementLayerRef.current) return;
    placementLayerRef.current.clearLayers();

    // Draw search boundary rectangle if bounds are set
    if (placementSearchBounds) {
      const rect = L.rectangle(
        [
          [placementSearchBounds.min_lat, placementSearchBounds.min_lon],
          [placementSearchBounds.max_lat, placementSearchBounds.max_lon],
        ],
        {
          color: '#3498db',
          fillColor: '#3498db',
          fillOpacity: 0.04,
          weight: 2,
          dashArray: '8, 4',
          interactive: false,
        },
      );
      placementLayerRef.current!.addLayer(rect);
    }

    placementSuggestions.forEach((sug, idx) => {
      // Dashed-outline circle for coverage preview
      const circle = L.circle([sug.latitude, sug.longitude], {
        radius: placementCoverageRadiusM,
        color: '#2ecc71',
        fillColor: '#2ecc71',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '8, 4',
      });

      // Ghost marker with "+" icon
      const ghostSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="#2ecc71" fill-opacity="0.5" stroke="#2ecc71" stroke-width="2" stroke-dasharray="4,3"/>
        <text x="14" y="18" text-anchor="middle" fill="#fff" font-size="16" font-weight="bold">+</text>
      </svg>`;
      const ghostIcon = L.divIcon({
        html: ghostSvg,
        className: 'placement-ghost-icon',
        iconSize: [28, 40],
        iconAnchor: [14, 40],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([sug.latitude, sug.longitude], { icon: ghostIcon, interactive: true });
      const scoreColor = sug.score > 0.7 ? '#2ecc71' : sug.score > 0.4 ? '#f1c40f' : '#e74c3c';
      marker.bindPopup(
        `<b>Suggested Location #${idx + 1}</b><br>` +
        `Score: <span style="color:${scoreColor}">${(sug.score * 100).toFixed(0)}%</span><br>` +
        `Coverage gain: ${sug.coverage_gain_km2.toFixed(2)} km&sup2;<br>` +
        `${sug.reason}`
      );
      marker.bindTooltip(`Suggestion #${idx + 1} (${(sug.score * 100).toFixed(0)}%)`);

      placementLayerRef.current!.addLayer(circle);
      placementLayerRef.current!.addLayer(marker);
    });
  }, [placementSuggestions, placementCoverageRadiusM, placementSearchBounds, nodes]);

  // Change cursor based on mode
  useEffect(() => {
    if (!mapRef.current) return;
    const mode = useMapStore.getState().mode;
    const plan = usePlanStore.getState().current_plan;
    if (mode === 'add_node' && plan) {
      mapRef.current.style.cursor = 'crosshair';
    } else {
      mapRef.current.style.cursor = '';
    }
  });

  // Build list of selected nodes for the info overlay
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(String(n.id)));

  return (
    <div className={`map-container ${className}`} style={{ height: '100%', minHeight: '400px', position: 'relative' }} role="application" aria-label="Interactive map">
      <div
        ref={mapRef}
        style={{ height: '100%', width: '100%' }}
      />
      {losOverlays.length > 0 && (
        <div className="los-legend">
          <div className="los-legend-title">LOS Quality</div>
          <div className="los-legend-item">
            <span className="los-legend-line" style={{ background: '#16a34a' }}></span>
            <span>Strong</span>
          </div>
          <div className="los-legend-item">
            <span className="los-legend-line los-legend-dashed" style={{ background: `repeating-linear-gradient(90deg, #eab308 0, #eab308 5px, transparent 5px, transparent 10px)` }}></span>
            <span>Marginal</span>
          </div>
          <div className="los-legend-item">
            <span className="los-legend-line los-legend-dashed" style={{ background: `repeating-linear-gradient(90deg, #f97316 0, #f97316 5px, transparent 5px, transparent 10px)` }}></span>
            <span>NLOS</span>
          </div>
          <div className="los-legend-item">
            <span className="los-legend-line los-legend-dashed" style={{ background: `repeating-linear-gradient(90deg, #dc2626 0, #dc2626 5px, transparent 5px, transparent 10px)` }}></span>
            <span>Not Viable</span>
          </div>
        </div>
      )}
      {selectedNodes.length > 0 && (
        <div className="node-info-overlay" role="complementary" aria-label="Selected node information">
          {selectedNodes.map((node) => (
            <div key={String(node.id)}
              className={`node-info-card${selectedNodeId === String(node.id) ? ' node-info-card-active' : ''}`}
              onClick={() => {
                // In multi-select, just shift primary focus without dropping the selection
                if (selectedNodeIds.length > 1) {
                  useMapStore.setState({ selected_node_id: String(node.id) });
                } else {
                  selectNode(String(node.id));
                }
              }}>
              <div className="node-info-name">
                {node.name}
                <button
                  className="node-info-close"
                  type="button"
                  title="Deselect node"
                  aria-label={`Deselect ${node.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeSelection(String(node.id));
                  }}
                >
                  &times;
                </button>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">Position:</span>
                <span>{node.latitude.toFixed(5)}, {node.longitude.toFixed(5)}</span>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">Height:</span>
                <span>{node.antenna_height_m}m</span>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">Device:</span>
                <span>{node.device_id}</span>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">TX Power:</span>
                <span>{node.tx_power_dbm} dBm</span>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">Frequency:</span>
                <span>{node.frequency_mhz} MHz</span>
              </div>
              {node.is_solar && (
                <div className="node-info-row">
                  <span className="node-info-label">Power:</span>
                  <span>Solar</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <CoverageLegend />
      <ElevationLegend />
    </div>
  );
}
