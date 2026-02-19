# Release Notes — Mesh Community Planner v1.0.0

**Release Date:** February 2026
**Status:** General Availability

---

## About This Release

Mesh Community Planner v1.0.0 is the first production release. It is a desktop application for planning LoRa mesh network deployments — place nodes on a map, simulate RF coverage with real terrain data, select hardware from a built-in catalog, and generate a bill of materials. Everything runs locally with no accounts, no cloud services, and no telemetry.

---

## Platform Support

Pre-built binaries are available for all three platforms:

| Platform | Format | File |
|----------|--------|------|
| Windows | NSIS installer (.exe) | `MeshCommunityPlanner-1.0.0-Setup.exe` |
| macOS | Disk image (.dmg) | `MeshCommunityPlanner-1.0.0.dmg` |
| Linux | AppImage | `MeshCommunityPlanner-1.0.0-x86_64.AppImage` |

All downloads are self-contained — no Python or Node.js installation required.

Download from the [GitHub Releases page](https://github.com/PapaSierra555/MeshCommunityPlanner/releases).

---

## Features

### Plan Management
- Create, rename, duplicate, and delete network plans
- Auto-save to local SQLite database
- Import/export plans as `.meshplan` JSON files
- 4 built-in sample plans to explore on first launch

### Node Placement and Configuration
- Click-to-place nodes on an interactive OpenStreetMap
- Node Configuration Wizard with 5 guided steps: Basic Info, Device, Radio, Antenna, Power
- Drag nodes to reposition after placement
- Bulk import nodes from CSV files

### Hardware Catalog
- 11+ pre-configured LoRa devices with real specs
- Three firmware families: Meshtastic, MeshCore, Reticulum/RNode
- Antenna catalog with gain and cable loss values
- Regulatory presets: US FCC 915, EU 868, EU 433, ANZ

### Propagation Analysis
- Instant free-space path loss (FSPL) preview circles
- Terrain-aware propagation (Longley-Rice/ITWOM)
- SRTM 30m elevation data with automatic download and caching

### Line-of-Sight Analysis
- Terrain elevation profiles between node pairs
- Fresnel zone clearance visualization
- Obstruction detection from terrain data

### Network Topology
- D3.js network graph visualization
- Critical node identification (articulation points)
- Connected component analysis
- Network diameter and hop count metrics

### Power Budgeting
- Battery capacity and runtime estimates
- Solar panel sizing recommendations
- Per-node power configuration

### Bill of Materials
- Automatic BOM generation from plan hardware
- Component categorization (devices, antennas, cables, power, enclosures)
- CSV and PDF export
- Printable deployment cards for field installation

### Import and Export
- `.meshplan` JSON format with integrity checksums
- `.meshnode` single-node export
- `.meshtemplate` reusable node configuration templates
- CSV node import with column auto-detection
- KML export for Google Earth

### Accessibility
- WCAG 2.2 AA compliance
- Full keyboard navigation
- Screen reader support with ARIA labels
- Focus indicators on all interactive elements

### Privacy
- All data stored locally — no telemetry, no analytics
- No user accounts or login required
- Localhost-only server binding
- Explicit consent required for external API calls

---

## System Requirements

- **Windows** 10 or later (64-bit)
- **macOS** 11 (Big Sur) or later
- **Linux** — Ubuntu 20.04+, Fedora 35+, or equivalent
- 4 GB RAM
- 500 MB disk space (plus up to 2 GB for cached map tiles and terrain data)
- Internet connection for map tiles and elevation data (offline after caching)
- Modern browser: Chrome 100+, Firefox 98+, Safari 15+, Edge 100+

---

## Known Issues

See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for current limitations and workarounds.

---

## License

Licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Copyright (c) 2025 PapaSierra555
