# Handoff Notes — MeshCore Third-Party Integration
**Date:** 2026-03-14
**Branch:** `main` at `162d916`

---

## Get Latest

```
git pull origin main
```

All 318 frontend + 154 backend tests should pass:
```
cd frontend && npx vitest run
cd backend && python -m pytest
```

---

## What Was Just Built (v1.3.0)

Full details in `CHANGELOG.md`. Short version:

- **ATAK Live KML endpoint** — `GET /api/atak/nodes.kml` serves plan nodes to ATAK with no TAK Server needed
- **MeshCore tools** — Airtime & Duty Cycle Calculator, Network Density Planner (both in More Tools → MeshCore tab)
- **Reticulum tools** — RNode Link Budget & Range Estimator, Transport Node Placement Advisor (More Tools → Reticulum tab)
- **Per-node coverage environment** — each node can override the global propagation environment
- **Internet Map import** — import nodes from MeshCore's live map (`map.meshcore.dev`)

---

## Your Task: MeshCore Third-Party Integration (Milestone 3, Chunk D)

### What to build

Extend the existing Internet Map Import to also support importing from a **self-hosted meshcore-hub** instance.

### Background — corrected

`map.meshcore.dev` **does** have a public JSON REST API (no auth required):

```
GET https://map.meshcore.dev/api/v1/nodes?binary=0
```

Returns a JSON array of all nodes globally (~7 MB). Each node has `public_key`, `name`, `device_role`, `lat`, `lon`, `last_seen`. Filter server-side before returning to the frontend.

The existing Internet Map Import (`backend/app/api/internet_map.py`) already proxies `map.meshcore.dev` via msgpack — this endpoint is the plain-JSON alternative on the same domain.

**meshcore-hub** (self-hosted) is a separate optional path for operators who run their own hub. Repo: `https://github.com/ipnet-mesh/meshcore-hub` — give attribution in code comments if referencing it.

- Endpoint: `GET /api/nodes?token=TOKEN`
- Returns same shape: `public_key`, `name`, `device_role`, `lat`, `lon`, `last_seen`

### Suggested approach

**Option A (simpler) — extend the public map import only:**
The public `map.meshcore.dev/api/v1/nodes?binary=0` endpoint covers the common case. Add a second backend route `GET /api/internet_map/nodes-json` that fetches this endpoint, filters/normalizes server-side, and returns JSON. Wire into the existing `InternetMapImportModal.tsx`.

**Option B — also support self-hosted meshcore-hub:**
1. New backend endpoint: `POST /api/import/meshcore-hub` — accepts `{url, token}` in body, proxies to `{url}/api/nodes?token={token}`, normalizes, returns JSON. Token stays server-side.
2. Add a "meshcore-hub (self-hosted)" source card in `InternetMapImportModal.tsx` alongside the existing internet map source.
3. Tests in `backend/tests/test_meshcore_hub.py` and `frontend/tests/components/MeshCoreHubImportModal.test.tsx`

Option B is the full implementation — proceed with whichever scope makes sense for your timeline.

### Where to look for patterns

- **Internet Map Import modal** (most similar): `frontend/src/components/plan/InternetMapImportModal.tsx`
- **Backend proxy pattern**: `backend/app/api/internet_map.py`
- **More Tools wiring**: `frontend/src/components/layout/Toolbar.tsx` — MeshCore section
- **Plan menu wiring**: `frontend/src/components/layout/AppLayout.tsx` — search for `onImportFromMap`

### Key constraints

- **Token must not be passed through the frontend** — always proxy through the FastAPI backend (meshcore-hub path)
- **Validate user-provided URL** — must be valid HTTP/HTTPS before proxying (meshcore-hub path)
- **Filter server-side** — the public endpoint returns ~7 MB globally; normalize to `{name, lat, lon, device_role, last_seen}` before sending to frontend
- **Timeout**: use `httpx` with a 10-second timeout (same as `internet_map.py`)
- **Attribution**: add a comment referencing `https://github.com/ipnet-mesh/meshcore-hub` in any code that implements the hub proxy

### Files to look at before writing any code

```
backend/app/api/internet_map.py       # proxy pattern to follow exactly
frontend/src/components/plan/InternetMapImportModal.tsx  # import UX pattern
frontend/tests/components/InternetMapImportModal.test.tsx  # test pattern
```

---

## Known Issues (Linux / Fresh Install)

### All POST/PUT endpoints return 405

Observed on Arch Linux fresh installs. Root cause: `msgpack` was missing from `requirements.txt`. Fixed in `46b99d0`. Run `pip install -r requirements.txt` after pulling and restart the backend.

To confirm this was the issue, check startup logs for:
```
WARNING  W2 routers not available — running without REST API endpoints
ERROR    Import error details: No module named 'msgpack'
```

### 49 frontend tests fail on Linux

`mapStore`, `ElevationLegend`, and `CoverageSettings` test files fail on Arch Linux (jsdom 28 + Vitest 4 interaction). All other 269 tests pass. Does not block feature work — the failing tests are for existing v1.2.0 components, not the import modal being built.

---

## Questions / Blockers

Reach out to the project owner via the repo issues or contact listed in the project README.
