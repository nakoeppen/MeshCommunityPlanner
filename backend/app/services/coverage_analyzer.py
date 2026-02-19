"""Coverage gap detection and network coverage area analysis.

Grid-based approach: lays a uniform grid over the area of interest,
checks which cells are within coverage of at least one node, and
reports uncovered gap regions.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters between two points."""
    R = 6_371_000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _meters_to_deg_lat(meters: float) -> float:
    """Approximate conversion from meters to degrees latitude."""
    return meters / 111_320.0


def _meters_to_deg_lon(meters: float, latitude: float) -> float:
    """Approximate conversion from meters to degrees longitude."""
    cos_lat = math.cos(math.radians(latitude))
    if cos_lat < 1e-10:
        return 0.0
    return meters / (111_320.0 * cos_lat)


@dataclass
class GapRegion:
    """A contiguous uncovered area."""

    center_lat: float
    center_lon: float
    area_km2: float
    cell_count: int

    def to_dict(self) -> dict:
        return {
            "center_lat": round(self.center_lat, 6),
            "center_lon": round(self.center_lon, 6),
            "area_km2": round(self.area_km2, 4),
            "cell_count": self.cell_count,
        }


@dataclass
class CoverageAnalysis:
    """Result of a coverage gap analysis."""

    total_area_km2: float
    covered_area_km2: float
    coverage_pct: float
    total_gap_area_km2: float
    gap_regions: list[GapRegion] = field(default_factory=list)
    node_count: int = 0
    redundant_area_km2: float = 0.0

    def to_dict(self) -> dict:
        return {
            "total_area_km2": round(self.total_area_km2, 4),
            "covered_area_km2": round(self.covered_area_km2, 4),
            "coverage_pct": round(self.coverage_pct, 2),
            "total_gap_area_km2": round(self.total_gap_area_km2, 4),
            "redundant_area_km2": round(self.redundant_area_km2, 4),
            "node_count": self.node_count,
            "gap_regions": [g.to_dict() for g in self.gap_regions],
        }


def _build_coverage_grid(
    nodes: list[dict],
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    step_lat: float,
    step_lon: float,
) -> tuple[list[list[int]], int, int]:
    """Build a grid marking coverage count at each cell.

    Returns (grid, rows, cols) where grid[r][c] = number of nodes covering cell.
    """
    rows = max(1, int((max_lat - min_lat) / step_lat))
    cols = max(1, int((max_lon - min_lon) / step_lon))

    grid = [[0] * cols for _ in range(rows)]

    for node in nodes:
        n_lat = node["latitude"]
        n_lon = node["longitude"]
        radius_m = node.get("coverage_radius_m", 1000.0)

        # Bounding box of node's coverage in grid indices
        r_lat = _meters_to_deg_lat(radius_m)
        r_lon = _meters_to_deg_lon(radius_m, n_lat)

        r_min = max(0, int((n_lat - r_lat - min_lat) / step_lat))
        r_max = min(rows - 1, int((n_lat + r_lat - min_lat) / step_lat))
        c_min = max(0, int((n_lon - r_lon - min_lon) / step_lon))
        c_max = min(cols - 1, int((n_lon + r_lon - min_lon) / step_lon))

        for r in range(r_min, r_max + 1):
            cell_lat = min_lat + (r + 0.5) * step_lat
            for c in range(c_min, c_max + 1):
                cell_lon = min_lon + (c + 0.5) * step_lon
                dist = _haversine_m(n_lat, n_lon, cell_lat, cell_lon)
                if dist <= radius_m:
                    grid[r][c] += 1

    return grid, rows, cols


def _flood_fill_gap(
    grid: list[list[int]], visited: list[list[bool]], start_r: int, start_c: int
) -> list[tuple[int, int]]:
    """Flood-fill to find contiguous uncovered cells."""
    rows = len(grid)
    cols = len(grid[0])
    cells: list[tuple[int, int]] = []
    stack = [(start_r, start_c)]

    while stack:
        r, c = stack.pop()
        if r < 0 or r >= rows or c < 0 or c >= cols:
            continue
        if visited[r][c] or grid[r][c] > 0:
            continue
        visited[r][c] = True
        cells.append((r, c))
        stack.extend([(r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)])

    return cells


def analyze_coverage_gaps(
    nodes: list[dict],
    bounds: dict,
    grid_resolution_m: float = 200,
) -> CoverageAnalysis:
    """Analyze coverage gaps within a bounded area.

    Args:
        nodes: List of dicts with node_id, latitude, longitude, coverage_radius_m.
        bounds: Dict with min_lat, min_lon, max_lat, max_lon.
        grid_resolution_m: Grid cell size in meters.

    Returns:
        CoverageAnalysis with gap regions sorted by area (largest first).
    """
    min_lat = bounds["min_lat"]
    min_lon = bounds["min_lon"]
    max_lat = bounds["max_lat"]
    max_lon = bounds["max_lon"]

    mid_lat = (min_lat + max_lat) / 2
    step_lat = _meters_to_deg_lat(grid_resolution_m)
    step_lon = _meters_to_deg_lon(grid_resolution_m, mid_lat)

    if step_lat <= 0 or step_lon <= 0:
        return CoverageAnalysis(
            total_area_km2=0.0,
            covered_area_km2=0.0,
            coverage_pct=0.0,
            total_gap_area_km2=0.0,
            node_count=len(nodes),
        )

    grid, rows, cols = _build_coverage_grid(
        nodes, min_lat, min_lon, max_lat, max_lon, step_lat, step_lon,
    )

    total_cells = rows * cols
    cell_area_km2 = (grid_resolution_m / 1000.0) ** 2

    covered_cells = 0
    redundant_cells = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] > 0:
                covered_cells += 1
                if grid[r][c] > 1:
                    redundant_cells += 1

    gap_cells = total_cells - covered_cells
    total_area = total_cells * cell_area_km2
    covered_area = covered_cells * cell_area_km2
    gap_area = gap_cells * cell_area_km2
    redundant_area = redundant_cells * cell_area_km2
    coverage_pct = (covered_cells / total_cells * 100) if total_cells > 0 else 0.0

    # Find contiguous gap regions via flood fill
    visited = [[False] * cols for _ in range(rows)]
    gap_regions: list[GapRegion] = []

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 0 and not visited[r][c]:
                cells = _flood_fill_gap(grid, visited, r, c)
                if cells:
                    lats = [min_lat + (cr + 0.5) * step_lat for cr, _ in cells]
                    lons = [min_lon + (cc + 0.5) * step_lon for _, cc in cells]
                    gap_regions.append(GapRegion(
                        center_lat=sum(lats) / len(lats),
                        center_lon=sum(lons) / len(lons),
                        area_km2=len(cells) * cell_area_km2,
                        cell_count=len(cells),
                    ))

    # Sort largest gap first
    gap_regions.sort(key=lambda g: g.area_km2, reverse=True)

    return CoverageAnalysis(
        total_area_km2=total_area,
        covered_area_km2=covered_area,
        coverage_pct=coverage_pct,
        total_gap_area_km2=gap_area,
        redundant_area_km2=redundant_area,
        gap_regions=gap_regions,
        node_count=len(nodes),
    )


def calculate_coverage_area(
    nodes: list[dict],
    grid_resolution_m: float = 100,
) -> dict:
    """Calculate total network coverage area.

    Computes bounds from node positions + their coverage radii,
    then runs a grid scan.

    Returns dict with total_area_km2, covered_area_km2, coverage_pct,
    redundant_area_km2.
    """
    if not nodes:
        return {
            "total_area_km2": 0.0,
            "covered_area_km2": 0.0,
            "coverage_pct": 0.0,
            "redundant_area_km2": 0.0,
            "node_count": 0,
        }

    # Compute bounding box from node positions + coverage radii
    max_radius = max(n.get("coverage_radius_m", 1000.0) for n in nodes)
    pad_lat = _meters_to_deg_lat(max_radius)
    lats = [n["latitude"] for n in nodes]
    lons = [n["longitude"] for n in nodes]
    mid_lat = sum(lats) / len(lats)
    pad_lon = _meters_to_deg_lon(max_radius, mid_lat)

    bounds = {
        "min_lat": min(lats) - pad_lat,
        "min_lon": min(lons) - pad_lon,
        "max_lat": max(lats) + pad_lat,
        "max_lon": max(lons) + pad_lon,
    }

    analysis = analyze_coverage_gaps(nodes, bounds, grid_resolution_m)

    return {
        "total_area_km2": round(analysis.total_area_km2, 4),
        "covered_area_km2": round(analysis.covered_area_km2, 4),
        "coverage_pct": round(analysis.coverage_pct, 2),
        "redundant_area_km2": round(analysis.redundant_area_km2, 4),
        "node_count": len(nodes),
    }
