"""Node placement suggestion service.

Greedy gap-filling algorithm: scans candidate locations in the bounding area,
scores each by how much new coverage it adds, and returns ranked suggestions.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from backend.app.services.coverage_analyzer import (
    _build_coverage_grid,
    _haversine_m,
    _meters_to_deg_lat,
    _meters_to_deg_lon,
)


@dataclass
class PlacementCandidate:
    """A suggested node placement location."""

    latitude: float
    longitude: float
    score: float
    coverage_gain_km2: float
    reason: str

    def to_dict(self) -> dict:
        return {
            "latitude": round(self.latitude, 6),
            "longitude": round(self.longitude, 6),
            "score": round(self.score, 1),
            "coverage_gain_km2": round(self.coverage_gain_km2, 4),
            "reason": self.reason,
        }


def suggest_next_placement(
    existing_nodes: list[dict],
    bounds: dict,
    coverage_radius_m: float = 1000.0,
    grid_resolution_m: float = 200,
    max_candidates: int = 5,
    elevation_checker=None,
) -> list[PlacementCandidate]:
    """Suggest the best locations to place the next node.

    Scans a coarse grid of candidate positions, scores each by coverage gain
    (uncovered cells that become covered), and returns the top candidates.

    Args:
        existing_nodes: Current network nodes with latitude, longitude, coverage_radius_m.
        bounds: Area bounds dict with min_lat, min_lon, max_lat, max_lon.
        coverage_radius_m: Coverage radius for the new node.
        grid_resolution_m: Resolution of the analysis grid.
        max_candidates: Maximum number of candidates to return.
        elevation_checker: Optional callable(lat, lon) -> Optional[int].
            Used to filter out water/ocean candidates (elevation <= 0 or None).

    Returns:
        List of PlacementCandidate sorted by score descending.
    """
    min_lat = bounds["min_lat"]
    min_lon = bounds["min_lon"]
    max_lat = bounds["max_lat"]
    max_lon = bounds["max_lon"]

    mid_lat = (min_lat + max_lat) / 2
    step_lat = _meters_to_deg_lat(grid_resolution_m)
    step_lon = _meters_to_deg_lon(grid_resolution_m, mid_lat)

    if step_lat <= 0 or step_lon <= 0:
        return []

    # Build current coverage grid
    grid, rows, cols = _build_coverage_grid(
        existing_nodes, min_lat, min_lon, max_lat, max_lon, step_lat, step_lon,
    )

    total_cells = rows * cols
    if total_cells == 0:
        return []

    cell_area_km2 = (grid_resolution_m / 1000.0) ** 2

    # Scan candidate positions on a coarser grid (every ~5 cells)
    candidate_step = max(1, int(coverage_radius_m / grid_resolution_m / 2))
    r_lat = _meters_to_deg_lat(coverage_radius_m)
    r_lon = _meters_to_deg_lon(coverage_radius_m, mid_lat)

    raw_candidates: list[tuple[float, float, float, int]] = []

    for r in range(0, rows, candidate_step):
        cand_lat = min_lat + (r + 0.5) * step_lat
        for c in range(0, cols, candidate_step):
            cand_lon = min_lon + (c + 0.5) * step_lon

            # Count uncovered cells this candidate would cover
            gain = 0
            cr_min = max(0, int((cand_lat - r_lat - min_lat) / step_lat))
            cr_max = min(rows - 1, int((cand_lat + r_lat - min_lat) / step_lat))
            cc_min = max(0, int((cand_lon - r_lon - min_lon) / step_lon))
            cc_max = min(cols - 1, int((cand_lon + r_lon - min_lon) / step_lon))

            for gr in range(cr_min, cr_max + 1):
                cell_lat = min_lat + (gr + 0.5) * step_lat
                for gc in range(cc_min, cc_max + 1):
                    cell_lon = min_lon + (gc + 0.5) * step_lon
                    if grid[gr][gc] == 0:
                        dist = _haversine_m(cand_lat, cand_lon, cell_lat, cell_lon)
                        if dist <= coverage_radius_m:
                            gain += 1

            raw_candidates.append((cand_lat, cand_lon, gain * cell_area_km2, gain))

    # ── Connectivity filter ──
    # A suggested node must be within communication range of at least one
    # existing node, otherwise it cannot form a mesh link and is useless.
    # This also naturally excludes bay/ocean candidates that are beyond the
    # island/landmass reach (e.g. Biscayne Bay candidates 3-4 km from Miami
    # Beach when coverage radius is ~3 km).
    if existing_nodes:
        connected = []
        for lat, lon, gain_km2, gain_cells in raw_candidates:
            reachable = False
            for node in existing_nodes:
                dist = _haversine_m(lat, lon, node["latitude"], node["longitude"])
                if dist <= coverage_radius_m:
                    reachable = True
                    break
            if reachable:
                connected.append((lat, lon, gain_km2, gain_cells))
        raw_candidates = connected

    # ── Elevation filter ──
    # Filter out water/ocean candidates using SRTM elevation data.
    # Rejects void pixels (None = no tile / ocean) and non-positive
    # elevations (sea level or below).
    if elevation_checker is not None:
        filtered = []
        for lat, lon, gain_km2, gain_cells in raw_candidates:
            elev = elevation_checker(lat, lon)
            if elev is not None and elev > 0:
                filtered.append((lat, lon, gain_km2, gain_cells))
        raw_candidates = filtered

    if not raw_candidates:
        # No candidates possible — suggest center
        center_lat = (min_lat + max_lat) / 2
        center_lon = (min_lon + max_lon) / 2
        return [PlacementCandidate(
            latitude=center_lat,
            longitude=center_lon,
            score=50.0,
            coverage_gain_km2=0.0,
            reason="Center of area (no candidates found)",
        )]

    # Sort by gain descending
    raw_candidates.sort(key=lambda x: x[2], reverse=True)

    # Greedy spread selection: pick the best, then mark its coverage as
    # covered so subsequent picks target different gaps. Enforce minimum
    # spacing = coverage_radius_m between selected candidates.
    max_gain = raw_candidates[0][2] if raw_candidates[0][2] > 0 else 1.0

    candidates: list[PlacementCandidate] = []
    selected_coords: list[tuple[float, float]] = []

    for lat, lon, gain_km2, gain_cells in raw_candidates:
        if len(candidates) >= max_candidates:
            break

        # Skip if too close to an already-selected candidate
        too_close = False
        for slat, slon in selected_coords:
            if _haversine_m(lat, lon, slat, slon) < coverage_radius_m:
                too_close = True
                break
        if too_close:
            continue

        # Recalculate gain using current (incrementally updated) grid
        actual_gain = 0
        cr_min = max(0, int((lat - r_lat - min_lat) / step_lat))
        cr_max = min(rows - 1, int((lat + r_lat - min_lat) / step_lat))
        cc_min = max(0, int((lon - r_lon - min_lon) / step_lon))
        cc_max = min(cols - 1, int((lon + r_lon - min_lon) / step_lon))
        covered_cells: list[tuple[int, int]] = []

        for gr in range(cr_min, cr_max + 1):
            cell_lat = min_lat + (gr + 0.5) * step_lat
            for gc in range(cc_min, cc_max + 1):
                cell_lon = min_lon + (gc + 0.5) * step_lon
                if grid[gr][gc] == 0:
                    dist = _haversine_m(lat, lon, cell_lat, cell_lon)
                    if dist <= coverage_radius_m:
                        actual_gain += 1
                        covered_cells.append((gr, gc))

        actual_gain_km2 = actual_gain * cell_area_km2
        score = (actual_gain_km2 / max_gain) if max_gain > 0 else 0.0

        if actual_gain == 0:
            reason = "No new coverage (area fully covered)"
        elif score > 0.75:
            reason = "Excellent: fills largest coverage gap"
        elif score > 0.50:
            reason = "Good: significant gap reduction"
        elif score > 0.25:
            reason = "Moderate: some new coverage"
        else:
            reason = "Marginal: limited new coverage"

        candidates.append(PlacementCandidate(
            latitude=lat,
            longitude=lon,
            score=round(score, 1),
            coverage_gain_km2=round(actual_gain_km2, 4),
            reason=reason,
        ))
        selected_coords.append((lat, lon))

        # Mark this candidate's coverage as covered for subsequent picks
        for gr, gc in covered_cells:
            grid[gr][gc] = 1

    return candidates


def evaluate_placement(
    candidate_lat: float,
    candidate_lon: float,
    coverage_radius_m: float,
    existing_nodes: list[dict],
    bounds: dict,
    grid_resolution_m: float = 200,
) -> dict:
    """Evaluate a specific candidate placement location.

    Returns coverage gain, new total coverage, connectivity to existing nodes.

    Args:
        candidate_lat, candidate_lon: Proposed location.
        coverage_radius_m: Coverage radius for the candidate.
        existing_nodes: Current network nodes.
        bounds: Area bounds.
        grid_resolution_m: Grid resolution for analysis.

    Returns:
        Dict with coverage_gain_km2, new_coverage_pct, score, connects_to list.
    """
    from backend.app.services.coverage_analyzer import analyze_coverage_gaps

    # Analyze before
    before = analyze_coverage_gaps(existing_nodes, bounds, grid_resolution_m)

    # Analyze after (with candidate added)
    candidate_node = {
        "node_id": "__candidate__",
        "latitude": candidate_lat,
        "longitude": candidate_lon,
        "coverage_radius_m": coverage_radius_m,
    }
    after = analyze_coverage_gaps(
        existing_nodes + [candidate_node], bounds, grid_resolution_m,
    )

    coverage_gain = after.covered_area_km2 - before.covered_area_km2

    # Find which existing nodes the candidate can connect to
    connects_to: list[str] = []
    for node in existing_nodes:
        dist = _haversine_m(
            candidate_lat, candidate_lon,
            node["latitude"], node["longitude"],
        )
        their_radius = node.get("coverage_radius_m", 1000.0)
        # Connection possible if within sum of radii
        if dist <= coverage_radius_m + their_radius:
            connects_to.append(node["node_id"])

    # Score based on coverage gain and connectivity
    max_possible_gain = before.total_gap_area_km2
    gain_score = (coverage_gain / max_possible_gain * 80) if max_possible_gain > 0 else 0
    connectivity_bonus = min(20, len(connects_to) * 10)
    score = min(100, gain_score + connectivity_bonus)

    return {
        "coverage_gain_km2": round(coverage_gain, 4),
        "new_coverage_pct": round(after.coverage_pct, 2),
        "old_coverage_pct": round(before.coverage_pct, 2),
        "score": round(score, 1),
        "connects_to": connects_to,
        "candidate": {
            "latitude": candidate_lat,
            "longitude": candidate_lon,
            "coverage_radius_m": coverage_radius_m,
        },
    }
