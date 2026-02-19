"""API handlers for coverage gap analysis and node placement suggestions.

Iteration 5 bonus: topology optimization per W0's optional task #5.
"""

from __future__ import annotations


async def handle_coverage_gap_analysis(data: dict) -> dict:
    """Analyze coverage gaps within a bounded area."""
    from backend.app.services.coverage_analyzer import analyze_coverage_gaps

    nodes = [n if isinstance(n, dict) else n for n in data.get("nodes", [])]
    bounds = data["bounds"]
    if not isinstance(bounds, dict):
        bounds = dict(bounds)

    analysis = analyze_coverage_gaps(
        nodes=nodes,
        bounds=bounds,
        grid_resolution_m=data.get("grid_resolution_m", 200),
    )
    return analysis.to_dict()


async def handle_coverage_area(data: dict) -> dict:
    """Calculate total network coverage area."""
    from backend.app.services.coverage_analyzer import calculate_coverage_area

    nodes = [n if isinstance(n, dict) else n for n in data.get("nodes", [])]
    return calculate_coverage_area(
        nodes=nodes,
        grid_resolution_m=data.get("grid_resolution_m", 100),
    )


async def handle_placement_suggest(data: dict, srtm_manager=None) -> dict:
    """Suggest optimal locations for the next node."""
    from backend.app.services.node_placement import suggest_next_placement

    existing = [n if isinstance(n, dict) else n for n in data.get("existing_nodes", [])]
    bounds = data["bounds"]
    if not isinstance(bounds, dict):
        bounds = dict(bounds)

    elevation_checker = None
    if srtm_manager is not None:
        elevation_checker = srtm_manager.read_elevation_cached

    candidates = suggest_next_placement(
        existing_nodes=existing,
        bounds=bounds,
        coverage_radius_m=data.get("coverage_radius_m", 1000.0),
        grid_resolution_m=data.get("grid_resolution_m", 200),
        max_candidates=data.get("max_candidates", 5),
        elevation_checker=elevation_checker,
    )
    return {
        "candidates": [c.to_dict() for c in candidates],
        "count": len(candidates),
    }


async def handle_placement_evaluate(data: dict) -> dict:
    """Evaluate a specific candidate placement location."""
    from backend.app.services.node_placement import evaluate_placement

    existing = [n if isinstance(n, dict) else n for n in data.get("existing_nodes", [])]
    bounds = data["bounds"]
    if not isinstance(bounds, dict):
        bounds = dict(bounds)

    return evaluate_placement(
        candidate_lat=data["candidate_lat"],
        candidate_lon=data["candidate_lon"],
        coverage_radius_m=data.get("coverage_radius_m", 1000.0),
        existing_nodes=existing,
        bounds=bounds,
        grid_resolution_m=data.get("grid_resolution_m", 200),
    )
