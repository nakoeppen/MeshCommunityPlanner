"""Terrain-aware coverage grid API handler.

Computes a radial sweep coverage grid using SRTM elevation data
and knife-edge diffraction, returning signal strength points for
SPLAT!-style heat map rendering.
"""

from __future__ import annotations

import logging
import math
from typing import Any

from backend.app.services.propagation.srtm import tiles_for_bounds

logger = logging.getLogger(__name__)


async def _ensure_srtm_tiles_for_coverage(
    srtm_manager: Any,
    center_lat: float,
    center_lon: float,
    max_radius_m: float,
) -> tuple[int, int]:
    """Download SRTM tiles needed for coverage grid around a center point.

    Returns (tiles_needed, tiles_available) tuple.
    """
    # Approximate bounding box from center + radius
    # ~111km per degree latitude, ~111km * cos(lat) per degree longitude
    lat_offset = max_radius_m / 111_000.0
    lon_offset = max_radius_m / (111_000.0 * max(math.cos(math.radians(center_lat)), 0.01))

    min_lat = center_lat - lat_offset
    max_lat = center_lat + lat_offset
    min_lon = center_lon - lon_offset
    max_lon = center_lon + lon_offset

    tiles = tiles_for_bounds(min_lat, min_lon, max_lat, max_lon)
    tiles_needed = len(tiles)
    tiles_available = 0

    for tile_lat, tile_lon in tiles:
        try:
            if not srtm_manager.has_hgt(tile_lat, tile_lon):
                logger.info("Downloading SRTM tile for (%d, %d)...", tile_lat, tile_lon)
                await srtm_manager.download_tile(tile_lat, tile_lon)
            if srtm_manager.has_hgt(tile_lat, tile_lon):
                tiles_available += 1
            else:
                logger.warning("SRTM tile (%d, %d) still not available", tile_lat, tile_lon)
        except Exception as e:
            logger.warning("Failed to download SRTM tile (%d, %d): %s", tile_lat, tile_lon, e)

    logger.info("SRTM tiles for coverage: %d/%d available", tiles_available, tiles_needed)
    return tiles_needed, tiles_available


async def handle_terrain_coverage_grid(request_data: dict) -> dict:
    """Handle terrain coverage grid computation request.

    Args:
        request_data: Dict with node params + optional _srtm_manager.

    Returns:
        Dict with node_id, points, bounds, environment, elevation_source,
        computation_time_ms.
    """
    from backend.app.services.propagation.coverage_grid import (
        compute_terrain_coverage_grid,
    )

    srtm_manager = request_data.pop("_srtm_manager", None)

    node_id = request_data.get("node_id", "node")
    latitude = request_data["latitude"]
    longitude = request_data["longitude"]
    antenna_height_m = request_data.get("antenna_height_m", 2.0)
    frequency_mhz = request_data.get("frequency_mhz", 906.875)
    tx_power_dbm = request_data.get("tx_power_dbm", 22.0)
    antenna_gain_dbi = request_data.get("antenna_gain_dbi", 3.0)
    cable_loss_db = request_data.get("cable_loss_db", 0.0)
    receiver_sensitivity_dbm = request_data.get("receiver_sensitivity_dbm", -130.0)
    environment = request_data.get("environment", "suburban")
    max_radius_m = request_data.get("max_radius_m", 15000.0)
    num_radials = request_data.get("num_radials", 360)
    sample_interval_m = request_data.get("sample_interval_m", 30.0)

    # PA signal chain: if PA params provided, compute effective TX power
    # effective_tx = min(device_tx + pa_gain, pa_max_output)
    pa_max_output = request_data.get("pa_max_output_power_dbm")
    pa_input_max = request_data.get("pa_input_range_max_dbm")
    if pa_max_output is not None and pa_input_max is not None:
        pa_gain = float(pa_max_output) - float(pa_input_max)
        effective_tx = min(tx_power_dbm + pa_gain, float(pa_max_output))
        logger.debug(
            "PA applied: device_tx=%.1f dBm + gain=%.1f dB → effective_tx=%.1f dBm (max_output=%.1f dBm)",
            tx_power_dbm, pa_gain, effective_tx, pa_max_output,
        )
        tx_power_dbm = effective_tx

    # Ensure SRTM tiles are available
    if srtm_manager is not None:
        await _ensure_srtm_tiles_for_coverage(
            srtm_manager, latitude, longitude, max_radius_m,
        )

    # Use cached elevation reader for performance
    def read_elevation(lat: float, lon: float):
        if srtm_manager is not None:
            return srtm_manager.read_elevation_cached(lat, lon)
        return None

    try:
        result = compute_terrain_coverage_grid(
            tx_lat=latitude,
            tx_lon=longitude,
            antenna_height_m=antenna_height_m,
            frequency_mhz=frequency_mhz,
            tx_power_dbm=tx_power_dbm,
            antenna_gain_dbi=antenna_gain_dbi,
            cable_loss_db=cable_loss_db,
            receiver_sensitivity_dbm=receiver_sensitivity_dbm,
            read_elevation=read_elevation,
            environment=environment,
            num_radials=num_radials,
            max_radius_m=max_radius_m,
            sample_interval_m=sample_interval_m,
        )
    finally:
        # Free memory cache after computation
        if srtm_manager is not None:
            srtm_manager.clear_memory_cache()

    return {
        "node_id": node_id,
        "points": result["points"],
        "bounds": result["bounds"],
        "environment": environment,
        "elevation_source": result["elevation_source"],
        "computation_time_ms": result["computation_time_ms"],
        "stats": result["stats"],
    }
