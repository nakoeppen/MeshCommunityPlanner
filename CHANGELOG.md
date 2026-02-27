# Changelog

All notable changes to Mesh Community Planner are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.2.0] — 2026-03

### Added
- **Elevation Heatmap** — Toggle a terrain elevation overlay on the map (Tools > Elevation Heatmap)
  - Hypsometric color ramp: blue (sea level) → green → yellow → orange → terracotta → gray → white (snow)
  - On-demand SRTM tile download from AWS S3 (no auth required)
  - Rendered 256×256 PNG tiles cached to disk for instant subsequent loads
  - Zoom levels 9–15 (matched to SRTM 30m resolution)
  - Pure-Python PNG encoder (no Pillow dependency)
  - Auth bypass for tile GET requests (query param token for Leaflet compatibility)
- **Elevation Range Controls** — Full-featured min/max elevation bounds in the legend panel
  - Dual-handle range slider with coloured fill; drag Min/Max thumbs simultaneously on one track
  - Min/Max number fields for precise direct entry; press Enter to commit, Escape to cancel
  - Mouse wheel fine-tuning on a focused slider thumb (±10m per tick; page scroll suppressed)
  - Keyboard navigation: arrow keys ±10m, **Page Up/Down** ±100m
  - Dynamic legend swatches recompute terrain colors (with terrain-type labels) to match the current range
  - Reset button restores the full default range (-500m to 9000m)
  - **"Remember range" checkbox** persists Min/Max to `localStorage` across sessions; build-ID gated so new builds start fresh
  - Range-specific tile caching; backend dynamic color interpolation with same 10-stop ramp
  - Full ARIA labels and keyboard focus indicators on all controls
- **Exit Application Dialog** — Top-level Exit button with styled confirmation dialog
  - Danger variant (red header) with Cancel, Exit, and X close buttons
  - Full focus trap (Tab/Shift+Tab cycle within dialog); Escape dismisses
  - `role="alertdialog"` and `aria-modal="true"` for screen reader support
  - Browser `beforeunload` safety net for accidental tab closes (production only)
  - Intentional exit bypasses browser's native "Leave site?" prompt
- **Windowless mode** — Windows build runs without a visible console window
- **Elevation Tile Streaming Guide** — `ELEVATION-TILE-STREAMING.md` developer documentation for adapting the tile pipeline to other servers (e.g., ATAK)
- **Test suite** — 241 automated tests
  - 36 backend Python tests (pytest): PNG encoder, tile renderer, color ramp, ranged color interpolation, API endpoints, auth middleware
  - 73 frontend unit tests (Vitest): Zustand store, ElevationLegend, ConfirmDialog (ARIA, focus trap, axe), mapStore (buildId persistence), Toolbar
  - 132 Playwright integration tests (Chromium + Firefox + WebKit): end-to-end elevation UI, exit-app dialog, accessibility

### Fixed
- Elevation legend opacity slider now has `aria-label` for screen reader accessibility
- Checkbox and number input vertical sizing in elevation legend panel
- `beforeunload` event no longer blocks Playwright tests in dev mode

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
