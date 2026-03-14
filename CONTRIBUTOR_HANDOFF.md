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

Allow users to import repeater positions and RF profiles from a **self-hosted meshcore-hub** instance into the planning tools.

### Background

There is no public REST API on `map.meshcore.dev` — the map data is MQTT-based (`meshcore/#` topics). The right integration path is **meshcore-hub**, a self-hostable REST API:

- Repo: `https://github.com/ipnet-mesh/meshcore-hub`
- Endpoint: `GET /api/nodes?token=TOKEN`
- Returns: `public_key`, `name`, `device_role`, `lat`, `lon`, `last_seen`
- Also has a Prometheus `/metrics` endpoint

No public instance exists — users run their own. The import flow should be:
1. User enters their meshcore-hub URL + token in a dialog
2. App fetches `/api/nodes?token=TOKEN` from the user-provided URL
3. Returns a table of nodes to review/select (same UX pattern as the Internet Map Import modal)
4. Selected nodes are added to the active plan

### Where to look for patterns

- **Internet Map Import modal** (most similar): `frontend/src/components/plan/InternetMapImportModal.tsx`
- **Backend proxy pattern** (so the token never goes to the frontend): `backend/app/api/internet_map.py`
- **More Tools wiring**: `frontend/src/components/layout/Toolbar.tsx` — MeshCore section
- **Plan menu wiring**: `frontend/src/components/layout/AppLayout.tsx` — search for `onImportFromMap`

### Suggested approach

1. New backend endpoint: `POST /api/import/meshcore-hub` — accepts `{url, token}` in request body, proxies to `{url}/api/nodes?token={token}`, normalizes response to `{name, lat, lon, device_role, last_seen}`, returns JSON. Token stays server-side.
2. Reuse `InternetMapImportModal.tsx` or add a second source card to it for "meshcore-hub (self-hosted)" — similar to how "rmap.world" is already a "coming soon" card
3. Tests in `backend/tests/test_meshcore_hub.py` and `frontend/tests/components/MeshCoreHubImportModal.test.tsx`

### Key constraints

- **Token must not be passed through the frontend** — always proxy through the FastAPI backend
- **No public URL to hardcode** — the URL is user-provided, validate it's a valid HTTP/HTTPS URL before proxying
- **Timeout**: use `httpx` with a 10-second timeout (same as `internet_map.py`)
- **Error handling**: return 503 with a clear message if the hub is unreachable, 401 if the token is rejected

### Files to look at before writing any code

```
backend/app/api/internet_map.py       # proxy pattern to follow exactly
frontend/src/components/plan/InternetMapImportModal.tsx  # import UX pattern
frontend/tests/components/InternetMapImportModal.test.tsx  # test pattern
```

---

## Questions / Blockers

Reach out to the project owner via the repo issues or contact listed in the project README.
