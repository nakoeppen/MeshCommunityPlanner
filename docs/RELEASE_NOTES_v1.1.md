# Release Notes — Mesh Community Planner v1.1.0

**Release Date:** February 2026
**Previous Release:** [v1.0.0](RELEASE_NOTES_v1.0.md)

---

## Summary

v1.1.0 adds the **Elevation Heatmap** feature — a terrain visualization layer that renders NASA SRTM elevation data directly on the map. It also introduces the project's first automated test suite (39 backend + frontend tests) and a developer guide for adapting the tile streaming pipeline to other servers.

---

## New Features

### Elevation Heatmap

A toggleable terrain overlay that shows elevation contours using a cartographic color ramp.

**How to use:**
1. Open the **Tools** menu
2. Click **Elevation Heatmap** (a checkmark appears when active)
3. Pan and zoom — SRTM tiles download automatically from AWS
4. Use the opacity slider in the bottom-right legend panel to adjust transparency

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

### Elevation Tile Streaming Guide

A new developer document (`ELEVATION-TILE-STREAMING.md`) explains the complete pipeline from AWS download through .hgt parsing, tile rendering, HTTP serving, and Leaflet integration. Includes working code examples and guidance for adapting the implementation to ATAK or other tile-consuming map clients.

---

## Test Suite

v1.1.0 introduces the project's first automated test infrastructure:

**Backend (24 tests — pytest):**
- `test_png_writer.py` — PNG signature, IHDR dimensions, error handling, edge cases
- `test_elevation_tiles.py` — Tile bounds math, color ramp values, renderer with disk caching
- `test_elevation_api.py` — FastAPI endpoint tests (auth, 204 responses, ensure-tiles, 503)
- `test_middleware_bypass.py` — Elevation tile endpoints bypass Bearer header auth

**Frontend (15 tests — Vitest):**
- `mapStore.test.ts` — Zustand store elevation state defaults and mutations
- `ElevationLegend.test.tsx` — Component rendering, opacity slider, swatch colors, axe-core a11y
- `Toolbar.elevation.test.tsx` — Toggle checkmark, click handler, title attribute, axe-core a11y

**Integration (6 tests — Playwright):**
- `elevation-heatmap.spec.ts` — End-to-end UI: toggle on/off, legend visibility, opacity slider, checkmark state

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
