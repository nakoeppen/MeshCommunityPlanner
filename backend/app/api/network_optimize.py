"""API handlers for viewshed, channel/power optimization, and resilience.

Iteration 6 Priorities 2 & 3.
"""

from __future__ import annotations


async def handle_viewshed(data: dict) -> dict:
    """Calculate viewshed from an observer position using SRTM terrain."""
    from backend.app.services.viewshed import calculate_viewshed

    srtm = data.pop("_srtm_manager", None)
    if srtm is None:
        from backend.app.services.propagation.srtm import SRTMManager
        from backend.app.config import get_data_dir
        data_dir = get_data_dir()
        srtm = SRTMManager(
            srtm_dir=str(data_dir / "srtm"),
            sdf_dir=str(data_dir / "sdf"),
        )

    targets = data.get("target_nodes", [])
    return calculate_viewshed(
        observer_lat=data["observer_lat"],
        observer_lon=data["observer_lon"],
        observer_height_m=data.get("observer_height_m", 10.0),
        target_nodes=targets,
        terrain_fn=srtm.read_elevation,
    )


async def handle_optimize_channels(data: dict) -> dict:
    """Optimize channel assignments across the network."""
    from backend.app.services.network_optimizer import optimize_channels

    return optimize_channels(
        nodes=data.get("nodes", []),
        edges=data.get("edges", []),
        region_id=data.get("region_id", "us_fcc"),
    )


async def handle_optimize_power(data: dict) -> dict:
    """Optimize TX power for each node."""
    from backend.app.services.network_optimizer import optimize_power

    return optimize_power(
        nodes=data.get("nodes", []),
        edges=data.get("edges", []),
        min_link_margin_db=data.get("min_link_margin_db", 3.0),
        max_tx_power_dbm=data.get("max_tx_power_dbm", 30.0),
    )


async def handle_resilience_score(data: dict) -> dict:
    """Generate network resilience score and recommendations."""
    from backend.app.services.network_optimizer import network_resilience_report

    return network_resilience_report(
        nodes=data.get("nodes", []),
        edges=data.get("edges", []),
    )
