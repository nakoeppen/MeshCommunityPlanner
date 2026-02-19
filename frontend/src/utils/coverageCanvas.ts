/**
 * Coverage Canvas Renderer
 *
 * Renders terrain-aware coverage grid points to an HTML5 canvas,
 * producing a filled coverage heat map
 * for L.imageOverlay.
 *
 * Key technique: each radial sample is painted as a filled sector
 * (distance-dependent brush size) so adjacent radials overlap and
 * the result is a continuous filled coverage area — not sparse dots.
 */

/**
 * SPLAT!-inspired color scheme for LoRa signal strength.
 * Maps dBm ranges to RGBA values with decreasing opacity for weaker signals.
 */
function signalToColor(dbm: number): [number, number, number, number] {
  if (dbm > -80)  return [255, 0, 0, 180];       // Red — strong
  if (dbm > -90)  return [255, 128, 0, 170];      // Orange
  if (dbm > -100) return [255, 255, 0, 160];      // Yellow
  if (dbm > -110) return [0, 200, 0, 150];        // Green
  if (dbm > -120) return [0, 200, 200, 130];      // Cyan
  if (dbm > -130) return [0, 0, 255, 100];        // Blue — weak
  return [0, 0, 0, 0];                             // Transparent — below threshold
}

export interface CoverageCanvasResult {
  dataUrl: string;
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
}

export interface CoveragePoint {
  lat: number;
  lon: number;
  signal_dbm: number;
}

export interface CoverageBounds {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
}

/**
 * Render coverage grid points to a filled coverage heat map.
 *
 * Each point is painted as a filled block sized to cover the gap between
 * adjacent radials at that distance from the transmitter.  This produces
 * a continuous filled coverage area.
 *
 * @param points     Array of {lat, lon, signal_dbm} from backend
 * @param bounds     Geographic bounds of the coverage grid
 * @param canvasWidth Canvas width in pixels (height is proportional)
 * @param txLat      Transmitter latitude (center of sweep)
 * @param txLon      Transmitter longitude (center of sweep)
 * @param numRadials Number of azimuth radials used in the sweep (default 360)
 */
export function renderCoverageCanvas(
  points: CoveragePoint[],
  bounds: CoverageBounds,
  canvasWidth: number = 1000,
  txLat?: number,
  txLon?: number,
  numRadials: number = 360,
): CoverageCanvasResult | null {
  if (points.length === 0) return null;

  const latRange = bounds.max_lat - bounds.min_lat;
  const lonRange = bounds.max_lon - bounds.min_lon;

  if (latRange <= 0 || lonRange <= 0) return null;

  // Correct aspect ratio for latitude (longitude degrees are shorter at higher latitudes)
  const midLat = (bounds.min_lat + bounds.max_lat) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);
  const canvasHeight = Math.max(1, Math.round(canvasWidth * (latRange / (lonRange * cosLat))));

  // TX center in pixel coordinates (for brush size computation)
  const centerLat = txLat ?? (bounds.min_lat + bounds.max_lat) / 2;
  const centerLon = txLon ?? (bounds.min_lon + bounds.max_lon) / 2;
  const cxPx = ((centerLon - bounds.min_lon) / lonRange) * (canvasWidth - 1);
  const cyPx = ((bounds.max_lat - centerLat) / latRange) * (canvasHeight - 1);

  // Angular gap factor: at pixel-distance d from center, the gap between
  // adjacent radials is  2 * PI * d / numRadials  pixels.
  // Brush radius = ceil(PI * d / numRadials) to ensure full fill with overlap.
  const angularFactor = Math.PI / numRadials;

  // Build signal grid — keep strongest signal per pixel
  const gridSize = canvasWidth * canvasHeight;
  const grid = new Float32Array(gridSize);
  grid.fill(-999);

  for (const pt of points) {
    // Map lat/lon to pixel coordinates
    const px = Math.floor(((pt.lon - bounds.min_lon) / lonRange) * (canvasWidth - 1));
    const py = Math.floor(((bounds.max_lat - pt.lat) / latRange) * (canvasHeight - 1));

    if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight) continue;

    // Distance from TX center in pixels
    const dx = px - cxPx;
    const dy = py - cyPx;
    const distPx = Math.sqrt(dx * dx + dy * dy);

    // Brush radius: fill the angular gap between adjacent radials at this distance
    // Plus 1 for the along-radial gap.  Min 1 so close-in points still paint.
    const brushR = Math.max(1, Math.ceil(distPx * angularFactor) + 1);

    // Paint filled square block — keep strongest signal per pixel
    const yMin = Math.max(0, py - brushR);
    const yMax = Math.min(canvasHeight - 1, py + brushR);
    const xMin = Math.max(0, px - brushR);
    const xMax = Math.min(canvasWidth - 1, px + brushR);

    for (let gy = yMin; gy <= yMax; gy++) {
      const rowOffset = gy * canvasWidth;
      for (let gx = xMin; gx <= xMax; gx++) {
        const idx = rowOffset + gx;
        if (pt.signal_dbm > grid[idx]) {
          grid[idx] = pt.signal_dbm;
        }
      }
    }
  }

  // Create canvas and paint pixels
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imageData = ctx.createImageData(canvasWidth, canvasHeight);
  const data = imageData.data;

  for (let i = 0; i < gridSize; i++) {
    if (grid[i] <= -999) continue; // No data — leave transparent

    const [r, g, b, a] = signalToColor(grid[i]);
    if (a === 0) continue;

    const offset = i * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = a;
  }

  ctx.putImageData(imageData, 0, 0);

  const dataUrl = canvas.toDataURL('image/png');
  const leafletBounds: [[number, number], [number, number]] = [
    [bounds.min_lat, bounds.min_lon],
    [bounds.max_lat, bounds.max_lon],
  ];

  return { dataUrl, bounds: leafletBounds };
}
