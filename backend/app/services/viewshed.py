"""Viewshed analysis service.

Determines which nodes a given observer can see, using terrain profile
LOS checks. Useful for network planning — "what can this node reach?"

Iteration 6 Priority 2: Advanced terrain features.
"""

from __future__ import annotations

from typing import Callable, Optional

from backend.app.services.propagation.fspl import haversine_distance_m
from backend.app.services.link_analysis import (
    interpolate_coordinates,
)


def calculate_viewshed(
    observer_lat: float,
    observer_lon: float,
    observer_height_m: float,
    target_nodes: list[dict],
    terrain_fn: Callable[[float, float], Optional[int]] | None = None,
    num_samples: int = 50,
) -> dict:
    """Calculate which target nodes are visible from an observer position.

    Uses terrain profile to check line-of-sight between the observer and
    each target node. If no terrain function is provided, assumes flat earth
    (all nodes visible).

    Args:
        observer_lat, observer_lon: Observer position.
        observer_height_m: Observer antenna height above ground.
        target_nodes: List of dicts with node_id, latitude, longitude,
            and optional coverage_radius_m.
        terrain_fn: Optional callable(lat, lon) -> elevation_m.
        num_samples: Samples per terrain profile check.

    Returns:
        Dict with visible/blocked node lists and summary.
    """
    def _elev(lat: float, lon: float) -> float:
        if terrain_fn is not None:
            val = terrain_fn(lat, lon)
            return float(val) if val is not None else 0.0
        return 0.0

    obs_elev = _elev(observer_lat, observer_lon)
    obs_tip = obs_elev + observer_height_m

    visible: list[dict] = []
    blocked: list[dict] = []

    for node in target_nodes:
        n_lat = node["latitude"]
        n_lon = node["longitude"]
        n_height = node.get("coverage_radius_m", 10.0)  # Use as approx antenna height
        # If node has explicit antenna_height_m, use that
        if "antenna_height_m" in node:
            n_height = node["antenna_height_m"]
        elif "coverage_radius_m" in node:
            n_height = 10.0  # default antenna height

        n_elev = _elev(n_lat, n_lon)
        n_tip = n_elev + n_height

        distance = haversine_distance_m(observer_lat, observer_lon, n_lat, n_lon)

        # Check LOS along path
        is_blocked = False
        max_obstruction = 0.0

        if distance > 0.1 and terrain_fn is not None:
            coords = interpolate_coordinates(
                observer_lat, observer_lon, n_lat, n_lon,
                max(num_samples, 2),
            )
            for i, (lat, lon) in enumerate(coords):
                if i == 0 or i == len(coords) - 1:
                    continue  # Skip endpoints
                t = i / (len(coords) - 1)
                los_height = obs_tip + t * (n_tip - obs_tip)
                terrain_elev = _elev(lat, lon)
                if terrain_elev > los_height:
                    is_blocked = True
                    obs_height = terrain_elev - los_height
                    if obs_height > max_obstruction:
                        max_obstruction = obs_height

        entry = {
            "node_id": node.get("node_id", "unknown"),
            "latitude": n_lat,
            "longitude": n_lon,
            "distance_m": round(distance, 1),
            "has_los": not is_blocked,
        }
        if is_blocked:
            entry["max_obstruction_m"] = round(max_obstruction, 1)
            blocked.append(entry)
        else:
            visible.append(entry)

    # Sort by distance
    visible.sort(key=lambda x: x["distance_m"])
    blocked.sort(key=lambda x: x["distance_m"])

    return {
        "observer": {
            "latitude": observer_lat,
            "longitude": observer_lon,
            "height_m": observer_height_m,
        },
        "visible": visible,
        "blocked": blocked,
        "visible_count": len(visible),
        "blocked_count": len(blocked),
        "total_nodes": len(target_nodes),
        "terrain_available": terrain_fn is not None,
    }
