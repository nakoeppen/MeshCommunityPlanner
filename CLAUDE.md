# Mesh Community Planner

## Overview
Desktop application for planning LoRa mesh network deployments with terrain-aware RF propagation modeling, interactive mapping, and hardware catalog management.

**Version:** 1.3.1 | **License:** CC BY-NC-SA 4.0
**Repo:** PapaSierra555/MeshCommunityPlanner (private)

## Tech Stack
- **Backend:** Python 3.9+ / FastAPI 0.128 / Uvicorn 0.34
- **Frontend:** React 19 / TypeScript 5.9 / Vite 7.2
- **Mapping:** Leaflet 1.9 + OpenStreetMap
- **State:** Zustand 5.0, Zundo (undo/redo)
- **3D/Viz:** Three.js + React Three Fiber + D3.js
- **Database:** SQLite (local, Pydantic settings)
- **RF Engine:** Longley-Rice/ITWOM via Signal-Server binary
- **Packaging:** PyInstaller 6.x + platform installers (NSIS/DMG/AppImage)

## Directory Structure
```
MeshCommunityPlanner/
├── backend/
│   ├── app/
│   │   ├── api/            # 15+ REST routers
│   │   ├── models/         # Pydantic models
│   │   ├── services/       # Propagation, topology, power budget, file I/O
│   │   ├── db/             # Migrations (005), seed data (JSON catalogs)
│   │   ├── security/       # Rate limiting, headers
│   │   └── websocket/      # Progress tracking
│   └── tests/              # 154 pytest tests
├── frontend/
│   ├── src/
│   │   ├── components/     # Map, plan, wizard, catalog, BOM, analysis, tools
│   │   ├── stores/         # Zustand (plan, node, settings, UI)
│   │   ├── data/           # Static firmware/device/antenna catalogs
│   │   └── utils/          # LoRa math, KML export, routing
│   └── tests/              # 371 Vitest + Playwright e2e tests
├── installers/             # PyInstaller spec + platform build scripts
├── docs/                   # User guide, install guide, tutorials, FAQ
├── test_plans/             # Sample .meshplan.json files
└── branding/               # App icons (teal theme)
```

## Build & Run

### Development
```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

### Tests
```bash
# Backend (154 tests)
cd backend && python -m pytest -v

# Frontend unit (371 tests)
cd frontend && npx vitest run

# E2E
cd frontend && npx playwright test
```

### Production Build
```bash
cd installers && python build.py
```

## Key Features
- Interactive map with node placement (11+ real LoRa devices)
- Terrain-aware RF propagation (SRTM 30m elevation data)
- Line-of-sight analysis with Fresnel zone visualization
- Network topology analysis with critical node detection
- BOM generation (CSV/PDF export)
- Protocol-specific tools (MeshCore, Reticulum)
- ATAK Live KML integration
- Regulatory presets (US FCC 915, EU 868/433, ANZ)
- Import/export (.meshplan JSON, CSV, KML)
- Fully offline after initial tile cache

## Multi-Worker Setup
Uses `git worktree` for parallel development (W1-W5). Worker branches are gitignored.

## Conventions
- Conventional commits (feat, fix, docs, test, refactor)
- SSH commit signing
- All coverage thresholds at 100% (frontend vitest.config.ts)

## Active Personas
- Architecture: See `C:\SOURCE CONTROL\ClaudeWorkflow\personas\system-architect.md`
- Code review: See `C:\SOURCE CONTROL\ClaudeWorkflow\personas\code-reviewer.md`
- Security: See `C:\SOURCE CONTROL\ClaudeWorkflow\personas\security-reviewer.md`
- QA: See `C:\SOURCE CONTROL\ClaudeWorkflow\personas\qa-engineer.md`
