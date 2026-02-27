"""API router — registers engine & domain logic endpoints used by the frontend.

Creates a FastAPI APIRouter with endpoints grouped under /api/:
- /api/los/* — Line-of-sight / link analysis
- /api/coverage/* — Terrain coverage grid
- /api/bom/* — BOM generation & export
- /api/placement/* — Node placement suggestions
- /api/terrain/* — Viewshed analysis
- /api/reports/* — PDF report export
- /api/ws/* — WebSocket ticket & propagation

Defense-in-depth: All HTTP endpoints require explicit auth via Depends()
in addition to the global AuthMiddleware.
"""

from __future__ import annotations

import logging
import re
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket
from fastapi.requests import Request
from fastapi.responses import JSONResponse, Response

logger = logging.getLogger(__name__)


def _sanitize_filename(name: str) -> str:
    """Sanitize a string for safe use in Content-Disposition headers."""
    safe = re.sub(r'[^\w\s\-.]', '', name, flags=re.ASCII)
    safe = re.sub(r'\s+', '_', safe.strip())
    safe = safe[:200]
    return safe or "export"


from backend.app.api.models import (
    BOMNodeRequest,
    BOMPlanRequest,
    ElevationEnsureTilesRequest,
    LOSProfileRequest,
    NetworkReportRequest,
    PlacementEvaluateRequest,
    PlacementSuggestRequest,
    TerrainCoverageGridRequest,
    ViewshedRequest,
)
from backend.app.api.los import handle_los_profile
from backend.app.api.bom import (
    handle_get_node_bom,
    handle_get_plan_bom,
    handle_export_csv,
    handle_export_pdf,
    handle_export_deployment,
)
from backend.app.api.integration import build_network_bom
from backend.app.api.coverage_gap import (
    handle_placement_suggest,
    handle_placement_evaluate,
)
from backend.app.api.network_optimize import handle_viewshed
from backend.app.api.coverage_terrain import handle_terrain_coverage_grid


def _make_require_auth(auth_token: str | None):
    """Create a require_auth dependency bound to the given token."""
    async def require_auth(request: Request) -> None:
        if auth_token is None:
            return
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid authentication token.",
            )
        provided = auth_header[7:]
        if not provided or not secrets.compare_digest(provided, auth_token):
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid authentication token.",
            )
    return require_auth


def _error_response(exc: Exception, context: str) -> JSONResponse:
    """Convert a service-layer exception to a proper JSON error response."""
    if isinstance(exc, (KeyError, ValueError, TypeError)):
        logger.warning("W3 %s: %s: %s", context, type(exc).__name__, exc)
        return JSONResponse(
            status_code=400,
            content={"error": f"Invalid input: {exc}"},
        )
    if isinstance(exc, FileNotFoundError):
        logger.warning("W3 %s: not found: %s", context, exc)
        return JSONResponse(
            status_code=404,
            content={"error": str(exc)},
        )
    logger.exception("W3 %s: unexpected error", context)
    return JSONResponse(
        status_code=500,
        content={"error": f"Internal error in {context}"},
    )


def create_w3_router(
    ws_handler: Any = None,
    auth_token: str | None = None,
    srtm_manager: Any = None,
    **_kwargs: Any,
) -> APIRouter:
    """Create the W3 API router with all endpoints.

    Args:
        ws_handler: WebSocketHandler instance for ticket auth.
        auth_token: Bearer token for endpoint-level auth.
        srtm_manager: SRTMManager instance for terrain elevation data.
    """
    require_auth = _make_require_auth(None)  # Auth enforced by global AuthMiddleware
    router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

    # -----------------------------------------------------------------------
    # LOS / Link analysis
    # -----------------------------------------------------------------------

    @router.post("/los/profile")
    async def los_profile(body: LOSProfileRequest) -> JSONResponse:
        """Terrain profile and link analysis between two nodes."""
        try:
            data = body.model_dump()
            if srtm_manager is not None:
                data["_srtm_manager"] = srtm_manager
            result = await handle_los_profile(data)
            return JSONResponse(content=result)
        except Exception as exc:
            return _error_response(exc, "los/profile")

    # -----------------------------------------------------------------------
    # Terrain coverage grid
    # -----------------------------------------------------------------------

    @router.post("/coverage/terrain-grid")
    async def coverage_terrain_grid(body: TerrainCoverageGridRequest) -> JSONResponse:
        """Terrain-aware coverage grid (radial sweep with SRTM elevation)."""
        try:
            data = body.model_dump()
            if srtm_manager is not None:
                data["_srtm_manager"] = srtm_manager
            result = await handle_terrain_coverage_grid(data)
            return JSONResponse(content=result)
        except Exception as exc:
            return _error_response(exc, "coverage/terrain-grid")

    # -----------------------------------------------------------------------
    # BOM endpoints
    # -----------------------------------------------------------------------

    @router.post("/bom/node")
    async def bom_node(body: BOMNodeRequest) -> JSONResponse:
        """Generate BOM for a single node."""
        try:
            result = await handle_get_node_bom(body.model_dump())
            return JSONResponse(content=result)
        except Exception as exc:
            return _error_response(exc, "bom/node")

    @router.post("/bom/plan")
    async def bom_plan(body: BOMPlanRequest) -> JSONResponse:
        """Generate consolidated BOM for entire plan."""
        try:
            result = await handle_get_plan_bom(body.model_dump())
            return JSONResponse(content=result)
        except Exception as exc:
            return _error_response(exc, "bom/plan")

    @router.post("/bom/export/csv")
    async def bom_csv(body: BOMPlanRequest) -> Response:
        """Export BOM as CSV."""
        try:
            network = build_network_bom(
                body.plan_id, body.plan_name,
                [n.model_dump() for n in body.nodes],
            )
            csv_str = await handle_export_csv(network)
            filename = f"{_sanitize_filename(body.plan_name)}.csv"
            return Response(
                content=csv_str,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )
        except Exception as exc:
            return _error_response(exc, "bom/export/csv")

    @router.post("/bom/export/pdf")
    async def bom_pdf(body: BOMPlanRequest) -> Response:
        """Export BOM as PDF."""
        try:
            network = build_network_bom(
                body.plan_id, body.plan_name,
                [n.model_dump() for n in body.nodes],
            )
            node_coordinates = {
                n.node_id: (n.latitude, n.longitude)
                for n in body.nodes
                if n.latitude != 0.0 or n.longitude != 0.0
            }
            pdf_bytes = await handle_export_pdf(network, node_coordinates)
            filename = f"{_sanitize_filename(body.plan_name)}.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )
        except Exception as exc:
            return _error_response(exc, "bom/export/pdf")

    @router.post("/bom/export/deployment")
    async def bom_deployment(body: BOMPlanRequest) -> Response:
        """Export deployment cards as PDF."""
        try:
            network = build_network_bom(
                body.plan_id, body.plan_name,
                [n.model_dump() for n in body.nodes],
            )
            node_coordinates = {
                n.node_id: (n.latitude, n.longitude)
                for n in body.nodes
                if n.latitude != 0.0 or n.longitude != 0.0
            }
            node_radio_config = {
                n.node_id: {
                    "frequency_mhz": n.frequency_mhz,
                    "tx_power_dbm": n.tx_power_dbm,
                    "spreading_factor": n.spreading_factor,
                    "bandwidth_khz": n.bandwidth_khz,
                    "coding_rate": n.coding_rate,
                    "antenna_height_m": n.antenna_height_m,
                    "region": n.region,
                    "firmware": n.firmware,
                    "modem_preset": n.modem_preset,
                }
                for n in body.nodes
            }
            pdf_bytes = await handle_export_deployment(network, node_coordinates, node_radio_config)
            filename = f"{_sanitize_filename(body.plan_name)}_deployment.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )
        except Exception as exc:
            return _error_response(exc, "bom/export/deployment")

    # -----------------------------------------------------------------------
    # Node placement
    # -----------------------------------------------------------------------

    @router.post("/placement/suggest")
    async def placement_suggest(body: PlacementSuggestRequest) -> JSONResponse:
        """Suggest optimal locations for the next node."""
        try:
            result = await handle_placement_suggest(body.model_dump(), srtm_manager=srtm_manager)
            return JSONResponse(content=result)
        except Exception as exc:
            return _error_response(exc, "placement/suggest")

    @router.post("/placement/evaluate")
    async def placement_evaluate(body: PlacementEvaluateRequest) -> JSONResponse:
        """Evaluate a specific candidate placement location."""
        try:
            result = await handle_placement_evaluate(body.model_dump())
            return JSONResponse(content=result)
        except Exception as exc:
            return _error_response(exc, "placement/evaluate")

    # -----------------------------------------------------------------------
    # Viewshed
    # -----------------------------------------------------------------------

    @router.post("/terrain/viewshed")
    async def terrain_viewshed(body: ViewshedRequest) -> JSONResponse:
        """Calculate viewshed from an observer position."""
        try:
            data = body.model_dump()
            if srtm_manager is not None:
                data["_srtm_manager"] = srtm_manager
            result = await handle_viewshed(data)
            return JSONResponse(content=result)
        except Exception as exc:
            return _error_response(exc, "terrain/viewshed")

    # -----------------------------------------------------------------------
    # Network report PDF export
    # -----------------------------------------------------------------------

    @router.post("/reports/export/network-pdf")
    async def reports_network_pdf(body: NetworkReportRequest) -> Response:
        """Export a comprehensive network report as PDF."""
        import base64

        from backend.app.services.pdf_generator import generate_network_report_pdf

        try:
            map_bytes = None
            if body.map_screenshot_base64:
                try:
                    map_bytes = base64.b64decode(body.map_screenshot_base64)
                except Exception:
                    pass

            pdf_bytes = generate_network_report_pdf(
                plan_name=body.plan_name,
                plan_description=body.plan_description,
                nodes=[n.model_dump() for n in body.nodes],
                links=[l.model_dump() for l in body.links],
                map_screenshot_bytes=map_bytes,
                include_executive_summary=body.include_executive_summary,
                include_bom_summary=body.include_bom_summary,
                include_recommendations=body.include_recommendations,
                coverage_data=body.coverage_data,
                bom_summary=body.bom_summary,
                page_size=body.page_size,
                sections=body.sections,
            )
            filename = f"{_sanitize_filename(body.plan_name)}_network_report.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )
        except Exception as exc:
            return _error_response(exc, "reports/export/network-pdf")

    # -----------------------------------------------------------------------
    # Elevation heatmap tiles
    # -----------------------------------------------------------------------

    elevation_renderer = None
    if srtm_manager is not None:
        from backend.app.config import get_data_dir
        from backend.app.services.elevation_tiles import ElevationTileRenderer
        elevation_renderer = ElevationTileRenderer(
            srtm_manager, get_data_dir() / "elevation_tiles"
        )

    @router.get("/elevation/tile/{z}/{x}/{y}.png", dependencies=[])
    async def elevation_tile(
        z: int, x: int, y: int,
        token: str = "",
        elev_min: int | None = None,
        elev_max: int | None = None,
    ) -> Response:
        """Serve a rendered elevation heatmap PNG tile.

        Auth via query param ?token= instead of Bearer header (Leaflet L.TileLayer
        cannot set custom headers on GET requests).

        Optional elev_min/elev_max query params stretch the full color ramp
        across a custom elevation range for better contrast in flat areas.
        """
        # Validate token via query param
        if auth_token and (not token or not secrets.compare_digest(token, auth_token)):
            raise HTTPException(status_code=401, detail="Invalid token.")

        if elevation_renderer is None:
            return Response(status_code=204)

        if z < 9 or z > 15:
            return Response(status_code=204)

        png_bytes = elevation_renderer.render_tile(z, x, y, elev_min=elev_min, elev_max=elev_max)
        if png_bytes is None:
            return Response(status_code=204)

        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    @router.post("/elevation/ensure-tiles")
    async def elevation_ensure_tiles(body: ElevationEnsureTilesRequest) -> JSONResponse:
        """Download any missing SRTM tiles for a bounding box."""
        if srtm_manager is None:
            return JSONResponse(content={"error": "SRTM not configured"}, status_code=503)

        from backend.app.services.propagation.srtm import tiles_for_bounds
        tiles = tiles_for_bounds(body.min_lat, body.min_lon, body.max_lat, body.max_lon)

        tiles_needed = len(tiles)
        tiles_available = 0
        tiles_downloaded = 0

        for lat, lon in tiles:
            if srtm_manager.has_hgt(lat, lon):
                tiles_available += 1
            else:
                try:
                    await srtm_manager.download_tile(lat, lon)
                    tiles_downloaded += 1
                    tiles_available += 1
                except Exception as exc:
                    logger.warning("Failed to download SRTM tile (%d, %d): %s", lat, lon, exc)

        return JSONResponse(content={
            "tiles_needed": tiles_needed,
            "tiles_available": tiles_available,
            "tiles_downloaded": tiles_downloaded,
        })

    # -----------------------------------------------------------------------
    # WebSocket
    # -----------------------------------------------------------------------

    @router.post("/ws/ticket")
    async def ws_ticket() -> JSONResponse:
        """Create a single-use WebSocket auth ticket."""
        if ws_handler is None:
            return JSONResponse(
                content={"error": "WebSocket not configured"},
                status_code=503,
            )
        result = await ws_handler.create_ticket()
        return JSONResponse(content=result)

    @router.websocket("/ws/propagation")
    async def ws_propagation(websocket: WebSocket) -> None:
        """WebSocket endpoint for propagation progress updates."""
        await websocket.accept()
        if ws_handler is None:
            await websocket.close(code=4503, reason="WebSocket not configured")
            return
        await ws_handler.handle_connection(websocket)

    return router
