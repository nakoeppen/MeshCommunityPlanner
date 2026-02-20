# Changelog

All notable changes to Mesh Community Planner are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.1.0] — 2026-02

### Added
- **Elevation Heatmap** — Toggle a terrain elevation overlay on the map (Tools → Elevation Heatmap)
  - Hypsometric color ramp: blue (sea level) → green → yellow → orange → terracotta → gray → white (snow)
  - On-demand SRTM tile download from AWS S3 (no auth required)
  - Rendered 256×256 PNG tiles cached to disk for instant subsequent loads
  - Adjustable opacity slider (0–100%) in the map legend panel
  - Zoom levels 9–15 (matched to SRTM 30m resolution)
  - Pure-Python PNG encoder (no Pillow dependency)
  - Auth bypass for tile GET requests (query param token for Leaflet compatibility)
- **Elevation Tile Streaming Guide** — `ELEVATION-TILE-STREAMING.md` developer documentation for adapting the tile pipeline to other servers (e.g., ATAK)
- **Test suite** — First automated tests for the project
  - 24 backend Python tests (pytest): PNG encoder, tile renderer, color ramp, API endpoints, auth middleware
  - 15 frontend unit tests (Vitest): Zustand store, ElevationLegend component, Toolbar integration
  - 6 Playwright integration tests: end-to-end elevation heatmap UI
  - Accessibility tests using axe-core (WCAG violation scanning)

### Fixed
- Elevation legend opacity slider now has `aria-label` for screen reader accessibility

---

## [1.0.0] — 2026-02

First production release.

### Added
- Interactive map interface with OpenStreetMap and node placement
- Node Configuration Wizard (5-step guided setup: Basic Info, Device, Radio, Antenna, Power)
- Hardware catalog with 11+ LoRa devices across Meshtastic, MeshCore, and Reticulum/RNode
- Regulatory presets for US FCC 915, EU 868, EU 433, and ANZ
- Free-space path loss (FSPL) instant coverage preview
- Terrain-aware propagation analysis (Longley-Rice/ITWOM)
- SRTM 30m terrain data with automatic download and local caching
- Line-of-sight terrain profiles with Fresnel zone clearance visualization
- Network topology graph (D3.js) with critical node detection and resilience metrics
- Power budgeting with battery and solar deployment recommendations
- Bill of materials generation with CSV and PDF export
- Printable deployment cards (one per node) for field installation
- Plan management: create, rename, duplicate, delete, auto-save
- Import/export in .meshplan JSON format with SHA-256 checksums
- Single-node export (.meshnode) and reusable templates (.meshtemplate)
- CSV bulk node import with column auto-detection
- KML export for Google Earth
- Address search via Nominatim geocoding
- 4 built-in sample plans seeded on first launch
- WCAG 2.2 AA accessibility with full keyboard navigation and screen reader support
- Offline operation after initial map and terrain data caching
- Privacy-first architecture: all data local, no telemetry, no accounts
- Cross-platform installers: Windows (.exe), macOS (.dmg), Linux (AppImage)
- Auto-open browser on application startup
- Clean shutdown when browser tab is closed
