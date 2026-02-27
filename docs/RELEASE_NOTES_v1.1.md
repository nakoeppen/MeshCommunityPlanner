# Release Notes — Mesh Community Planner v1.1.0

**Release Date:** February 2026
**Previous Release:** [v1.0.0](RELEASE_NOTES_v1.0.md)

---

## Summary

v1.1.0 adds the **Elevation Heatmap** feature — a terrain visualization layer that renders NASA SRTM elevation data directly on the map — with **Elevation Range Sliders** for narrowing the color ramp to local elevation ranges. It also introduces the project's first automated test suite (59 backend + frontend + integration tests) and a developer guide for adapting the tile streaming pipeline to other servers.

---

## New Features

### Elevation Heatmap

A toggleable terrain overlay that shows elevation contours using a cartographic color ramp.

**How to use:**
1. Open the **Tools** menu
2. Click **Elevation Heatmap** (a checkmark appears when active)
3. Pan and zoom — SRTM tiles download automatically from AWS
4. Use the opacity slider in the bottom-right legend panel to adjust transparency
5. Use the Min/Max elevation sliders to narrow the color range for your area

**Color scale:**

| Color | Elevation | Terrain |
|-------|-----------|---------|
| Steel blue | < 0 m | Below sea level |
| Forest green | 0 m | Sea level |
| Medium green | 50 m | Lowland |
| Yellow-green | 200 m | Low hills |
| Bright yellow | 500 m | Uplands |
| Amber-gold | 800 m | Foothills |
| Deep orange | 1,200 m | Lower mountains |
| Terracotta | 2,000 m | Mid-altitude mountains |
| Gray | 3,000 m | Alpine / above treeline |
| Near-white | 4,500 m+ | Snow / glacier |

The color ramp follows established cartographic conventions (Google Earth Engine, GMT globe, Imhof hypsometric tinting). Every adjacent color pair differs in both hue and lightness for maximum visual distinction.

**Technical details:**
- Data source: NASA SRTM1 (1 arc-second, ~30 m resolution)
- Download: On-demand from AWS S3 public bucket (no API key required)
- Tile format: Standard slippy map z/x/y PNG (256×256 pixels)
- Zoom range: 9–15
- Caching: Three-layer (browser → rendered PNG disk cache → in-memory .hgt LRU)
- No new dependencies: PNG encoding uses only Python stdlib (struct + zlib)

### Elevation Range Sliders

Adjustable min/max elevation bounds let you focus the full color spectrum on a narrow local range — essential for planning in flat terrain where the default -500m to 9000m scale shows everything as a single muddy color.

**Features:**
- Min and Max sliders in the elevation legend panel (-500m to 9000m, step 10m)
- Live preview: legend swatches and labels update during drag
- Tiles re-render with the new color mapping on slider release
- Reset button restores default range
- Range-specific tile caching (switching back to a previous range is instant)
- Both sliders have `aria-label` attributes for screen reader accessibility

**Example:** For a Wisconsin deployment (elevations ~160m to ~360m), set Min=150, Max=400. The full blue-to-white color ramp now spans just 250m of local elevation, revealing terrain detail that was previously invisible.

### Elevation Tile Streaming Guide

A new developer document (`ELEVATION-TILE-STREAMING.md`) explains the complete pipeline from AWS download through .hgt parsing, tile rendering, HTTP serving, and Leaflet integration. Includes working code examples and guidance for adapting the implementation to ATAK or other tile-consuming map clients.

---

## Test Suite

v1.1.0 introduces the project's first automated test infrastructure:

**Backend (23 tests — pytest):**
- `test_png_writer.py` — PNG signature, IHDR dimensions, error handling, edge cases
- `test_elevation_tiles.py` — Tile bounds math, color ramp values, ranged color interpolation (bottom/top/mid/clamping/inverted), cache path formats, renderer with disk caching
- `test_elevation_api.py` — FastAPI endpoint tests (auth, 204 responses, ensure-tiles, 503)
- `test_middleware_bypass.py` — Elevation tile endpoints bypass Bearer header auth

**Frontend (22 tests — Vitest):**
- `mapStore.test.ts` — Zustand store elevation state defaults, mutations, setElevationRange
- `ElevationLegend.test.tsx` — Component rendering, opacity slider, min/max range sliders, numeric range values, Reset button visibility and behavior, dynamic swatch colors, swatch labels with custom range, axe-core a11y
- `Toolbar.elevation.test.tsx` — Toggle checkmark, click handler, title attribute, axe-core a11y

**Integration (14 tests — Playwright):**
- `elevation-heatmap.spec.ts` — End-to-end UI: toggle on/off, legend visibility, opacity slider, checkmark state, min/max slider defaults, Reset button behavior, range slider accessibility (aria-labels), swatch count after range change

---

## Accessibility Fix

- The elevation legend opacity slider now includes an `aria-label="Elevation layer opacity"` attribute for screen readers (caught by axe-core automated testing)

---

## Downloads

| Platform | Format | File |
|----------|--------|------|
| **Windows** | Portable (.zip) | `MeshCommunityPlanner-1.1.0-win.zip` |
| **macOS** | Disk image (.dmg) | `MeshCommunityPlanner-1.1.0.dmg` |
| **Linux** | AppImage | `MeshCommunityPlanner-1.1.0-x86_64.AppImage` |
| **Linux** | Debian package | `mesh-community-planner_1.1.0_amd64.deb` |

---

## Verification

```bash
# Backend tests
python -m pytest backend/tests/ -v

# Frontend unit tests
cd frontend && npm test

# Playwright integration tests (requires dev server)
cd frontend && npm run test:integration
```
