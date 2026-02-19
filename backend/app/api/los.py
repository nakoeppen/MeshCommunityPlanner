"""Line-of-sight API endpoint handlers.

POST /los/profile — Terrain profile between two nodes with Fresnel zone
                    and obstruction data.

Note: Full FastAPI route registration requires W1's app skeleton.
This module defines handler functions that can be tested independently.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


async def _ensure_srtm_tiles(srtm_manager: Any, lat_a: float, lon_a: float,
                              lat_b: float, lon_b: float) -> tuple[int, int]:
    """Download SRTM tiles needed for the path between two points.

    Downloads only .hgt tiles (skips SDF conversion which requires external
    binary). Returns (tiles_needed, tiles_available) tuple.
    """
    from backend.app.services.propagation.srtm import tiles_for_bounds

    min_lat = min(lat_a, lat_b)
    max_lat = max(lat_a, lat_b)
    min_lon = min(lon_a, lon_b)
    max_lon = max(lon_a, lon_b)

    tiles = tiles_for_bounds(min_lat, min_lon, max_lat, max_lon)
    tiles_needed = len(tiles)
    tiles_available = 0

    for tile_lat, tile_lon in tiles:
        try:
            if not srtm_manager.has_hgt(tile_lat, tile_lon):
                logger.info("Downloading SRTM tile for (%d, %d)...", tile_lat, tile_lon)
                await srtm_manager.download_tile(tile_lat, tile_lon)
            # Verify tile is actually available after download attempt
            if srtm_manager.has_hgt(tile_lat, tile_lon):
                tiles_available += 1
            else:
                logger.warning("SRTM tile (%d, %d) still not available after download", tile_lat, tile_lon)
        except Exception as e:
            logger.warning("Failed to download SRTM tile (%d, %d): %s", tile_lat, tile_lon, e)

    logger.info("SRTM tiles: %d/%d available", tiles_available, tiles_needed)
    return tiles_needed, tiles_available


async def handle_los_profile(request_data: dict) -> dict:
    """Handle POST /los/profile — terrain profile between two nodes.

    Args:
        request_data: Dict with node_a (lat/lon/height), node_b (lat/lon/height),
                      frequency_mhz, and optional num_samples.

    Returns:
        Dict with profile points, obstruction analysis, and link assessment.
    """
    from backend.app.services.link_analysis import analyze_link, ProfilePoint
    from backend.app.services.propagation.engine import NodeParams

    node_a_data = request_data["node_a"]
    node_b_data = request_data["node_b"]

    node_a = NodeParams(
        node_id=node_a_data.get("node_id", "node-a"),
        latitude=node_a_data["latitude"],
        longitude=node_a_data["longitude"],
        antenna_height_m=node_a_data.get("antenna_height_m", 2.0),
        frequency_mhz=node_a_data.get("frequency_mhz", request_data.get("frequency_mhz", 915.0)),
        tx_power_dbm=node_a_data.get("tx_power_dbm", 22.0),
        antenna_gain_dbi=node_a_data.get("antenna_gain_dbi", 3.0),
        cable_loss_db=node_a_data.get("cable_loss_db", 0.0),
        receiver_sensitivity_dbm=node_a_data.get("receiver_sensitivity_dbm", -130.0),
    )

    node_b = NodeParams(
        node_id=node_b_data.get("node_id", "node-b"),
        latitude=node_b_data["latitude"],
        longitude=node_b_data["longitude"],
        antenna_height_m=node_b_data.get("antenna_height_m", 2.0),
        frequency_mhz=node_b_data.get("frequency_mhz", request_data.get("frequency_mhz", 915.0)),
        tx_power_dbm=node_b_data.get("tx_power_dbm", 22.0),
        antenna_gain_dbi=node_b_data.get("antenna_gain_dbi", 3.0),
        cable_loss_db=node_b_data.get("cable_loss_db", 0.0),
        receiver_sensitivity_dbm=node_b_data.get("receiver_sensitivity_dbm", -130.0),
    )

    num_samples = request_data.get("num_samples", 100)

    # Use SRTM terrain elevation when manager is provided, otherwise flat terrain
    srtm_manager = request_data.get("_srtm_manager")
    elevation_source = "flat_terrain"

    if srtm_manager is not None:
        # Ensure SRTM tiles are downloaded for the path bounding box
        tiles_needed, tiles_available = await _ensure_srtm_tiles(
            srtm_manager,
            node_a.latitude, node_a.longitude,
            node_b.latitude, node_b.longitude,
        )

        if tiles_available > 0:
            read_fn = srtm_manager.read_elevation
            if tiles_available == tiles_needed:
                elevation_source = "srtm_30m"
            else:
                elevation_source = "srtm_partial"
        else:
            logger.warning("No SRTM tiles available — falling back to flat terrain")
            def read_fn(lat: float, lon: float) -> Optional[int]:
                return 0
    else:
        logger.info("No SRTM manager — using flat terrain for LOS")
        def read_fn(lat: float, lon: float) -> Optional[int]:
            return 0  # Flat terrain fallback

    result = analyze_link(
        node_a=node_a,
        node_b=node_b,
        read_elevation_fn=read_fn,
        num_samples=num_samples,
    )

    # Serialize profile points
    profile_points = [
        {
            "distance_m": p.distance_m,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "elevation_m": p.elevation_m,
            "los_height_m": p.los_height_m,
            "fresnel_radius_m": p.fresnel_radius_m,
            "fresnel_clearance_m": p.fresnel_clearance_m,
            "is_obstructed": p.is_obstructed,
            "fresnel_obstructed": p.fresnel_obstructed,
        }
        for p in result.profile.points
    ]

    # Check if terrain data actually affected the result
    # (even with SRTM, read_elevation may return None for some points → 0m fallback)
    elevations = [p.elevation_m for p in result.profile.points]
    max_elevation = max(elevations) if elevations else 0
    min_elevation = min(elevations) if elevations else 0
    if elevation_source.startswith("srtm") and max_elevation == 0 and min_elevation == 0:
        logger.warning("SRTM source but all elevations are 0 — tiles may contain ocean/void data")
        elevation_source = "srtm_no_data"

    return {
        "node_a_id": result.node_a_id,
        "node_b_id": result.node_b_id,
        "distance_m": result.distance_m,
        "profile": profile_points,
        "free_space_loss_db": result.free_space_loss_db,
        "total_path_loss_db": result.total_path_loss_db,
        "received_signal_dbm": result.received_signal_dbm,
        "link_margin_db": result.link_margin_db,
        "is_viable": result.is_viable,
        "link_quality": result.link_quality,
        "has_los": result.has_los,
        "max_obstruction_m": result.max_obstruction_m,
        "fresnel_clearance_pct": result.fresnel_clearance_pct,
        "estimated_additional_loss_db": result.estimated_additional_loss_db,
        "error": result.error,
        "elevation_source": elevation_source,
        "elevation_min_m": min_elevation,
        "elevation_max_m": max_elevation,
    }
