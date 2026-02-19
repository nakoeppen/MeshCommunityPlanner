"""Link analysis service — terrain profiles, Fresnel zones, obstruction detection.

Combines SRTM terrain data with propagation calculations to provide
terrain-aware point-to-point link analysis between two nodes.

Phase 12 tasks: 12.1 (terrain profile), 12.2 (Fresnel zone), 12.3 (link analysis).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from collections.abc import Callable
from typing import Optional

from backend.app.services.propagation.engine import NodeParams, PropagationModel
from backend.app.services.propagation.fspl import (
    FSPLEngine,
    fspl_loss_db,
    haversine_distance_m,
)

# Speed of light in m/s
C = 299_792_458.0


@dataclass
class ProfilePoint:
    """A single point along a terrain profile between two nodes."""

    distance_m: float
    latitude: float
    longitude: float
    elevation_m: float
    los_height_m: float
    fresnel_radius_m: float
    fresnel_clearance_m: float
    is_obstructed: bool
    fresnel_obstructed: bool

    def to_dict(self) -> dict:
        return {
            "distance_m": self.distance_m,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "elevation_m": self.elevation_m,
            "los_height_m": self.los_height_m,
            "fresnel_radius_m": self.fresnel_radius_m,
            "fresnel_clearance_m": self.fresnel_clearance_m,
            "is_obstructed": self.is_obstructed,
            "fresnel_obstructed": self.fresnel_obstructed,
        }


@dataclass
class TerrainProfile:
    """Complete terrain profile between two nodes."""

    points: list[ProfilePoint] = field(default_factory=list)
    total_distance_m: float = 0.0
    node_a_height_m: float = 0.0
    node_b_height_m: float = 0.0

    def to_dict(self) -> dict:
        return {
            "total_distance_m": self.total_distance_m,
            "node_a_height_m": self.node_a_height_m,
            "node_b_height_m": self.node_b_height_m,
            "points": [p.to_dict() for p in self.points],
        }


@dataclass
class LinkAnalysisResult:
    """Result of a comprehensive link analysis."""

    node_a_id: str
    node_b_id: str
    distance_m: float
    profile: TerrainProfile
    free_space_loss_db: float = 0.0
    total_path_loss_db: float = 0.0
    received_signal_dbm: float = 0.0
    link_margin_db: float = 0.0
    is_viable: bool = False
    link_quality: str = "weak"
    has_los: bool = True
    max_obstruction_m: float = 0.0
    fresnel_clearance_pct: float = 100.0
    estimated_additional_loss_db: float = 0.0
    error: Optional[str] = None

    def to_dict(self, include_profile: bool = True) -> dict:
        d: dict = {
            "node_a_id": self.node_a_id,
            "node_b_id": self.node_b_id,
            "distance_m": self.distance_m,
            "free_space_loss_db": self.free_space_loss_db,
            "total_path_loss_db": self.total_path_loss_db,
            "received_signal_dbm": self.received_signal_dbm,
            "link_margin_db": self.link_margin_db,
            "is_viable": self.is_viable,
            "link_quality": self.link_quality,
            "has_los": self.has_los,
            "max_obstruction_m": self.max_obstruction_m,
            "fresnel_clearance_pct": self.fresnel_clearance_pct,
            "estimated_additional_loss_db": self.estimated_additional_loss_db,
            "error": self.error,
        }
        if include_profile:
            d["profile"] = self.profile.to_dict()
        return d


def interpolate_coordinates(
    lat1: float, lon1: float, lat2: float, lon2: float, num_samples: int
) -> list[tuple[float, float]]:
    """Interpolate lat/lon points along a great circle path.

    Uses simple linear interpolation (adequate for short distances < 100 km
    typical of LoRa mesh links).

    Args:
        lat1, lon1: Start point (decimal degrees).
        lat2, lon2: End point (decimal degrees).
        num_samples: Number of sample points including endpoints.

    Returns:
        List of (latitude, longitude) tuples.
    """
    if num_samples < 2:
        raise ValueError("num_samples must be >= 2")

    points = []
    for i in range(num_samples):
        t = i / (num_samples - 1)
        lat = lat1 + t * (lat2 - lat1)
        lon = lon1 + t * (lon2 - lon1)
        points.append((lat, lon))
    return points


def extract_terrain_profile(
    read_elevation_fn: Callable[[float, float], Optional[int]],
    lat1: float,
    lon1: float,
    height1_m: float,
    lat2: float,
    lon2: float,
    height2_m: float,
    frequency_mhz: float,
    num_samples: int = 100,
) -> TerrainProfile:
    """Extract terrain profile between two points using SRTM elevation data.

    Args:
        read_elevation_fn: Callable(lat, lon) -> Optional[int] to read elevation.
        lat1, lon1: Start node coordinates.
        height1_m: Start node antenna height above ground (m).
        lat2, lon2: End node coordinates.
        height2_m: End node antenna height above ground (m).
        frequency_mhz: Operating frequency for Fresnel zone calculation.
        num_samples: Number of sample points along the path.

    Returns:
        TerrainProfile with elevation, LOS, and Fresnel data at each sample.
    """
    if num_samples < 2:
        raise ValueError("num_samples must be >= 2")

    total_distance = haversine_distance_m(lat1, lon1, lat2, lon2)
    coords = interpolate_coordinates(lat1, lon1, lat2, lon2, num_samples)

    # Get start/end ground elevations
    elev_a = read_elevation_fn(lat1, lon1)
    elev_b = read_elevation_fn(lat2, lon2)
    if elev_a is None:
        elev_a = 0
    if elev_b is None:
        elev_b = 0

    # Antenna tips AMSL
    tip_a = elev_a + height1_m
    tip_b = elev_b + height2_m

    # Wavelength in meters
    wavelength_m = C / (frequency_mhz * 1e6)

    points: list[ProfilePoint] = []
    for i, (lat, lon) in enumerate(coords):
        t = i / (num_samples - 1)
        distance_along = t * total_distance

        # Read elevation
        elev = read_elevation_fn(lat, lon)
        if elev is None:
            elev = 0

        # LOS line height at this point (linear interpolation between antenna tips)
        los_height = tip_a + t * (tip_b - tip_a)

        # First Fresnel zone radius
        d1 = distance_along
        d2 = total_distance - distance_along
        fresnel_radius = fresnel_zone_radius(wavelength_m, d1, d2)

        # Clearance = LOS height - ground elevation
        clearance_from_los = los_height - elev
        fresnel_clearance = clearance_from_los - fresnel_radius

        is_obstructed = elev > los_height
        fresnel_obstructed = elev > (los_height - fresnel_radius)

        points.append(ProfilePoint(
            distance_m=distance_along,
            latitude=lat,
            longitude=lon,
            elevation_m=float(elev),
            los_height_m=los_height,
            fresnel_radius_m=fresnel_radius,
            fresnel_clearance_m=fresnel_clearance,
            is_obstructed=is_obstructed,
            fresnel_obstructed=fresnel_obstructed,
        ))

    return TerrainProfile(
        points=points,
        total_distance_m=total_distance,
        node_a_height_m=float(tip_a),
        node_b_height_m=float(tip_b),
    )


def fresnel_zone_radius(
    wavelength_m: float, d1_m: float, d2_m: float
) -> float:
    """Calculate first Fresnel zone radius at a point along the path.

    F1 = sqrt(λ * d1 * d2 / (d1 + d2))

    At endpoints (d1=0 or d2=0), the radius is 0.

    Args:
        wavelength_m: Signal wavelength in meters.
        d1_m: Distance from point to node A in meters.
        d2_m: Distance from point to node B in meters.

    Returns:
        First Fresnel zone radius in meters.
    """
    total = d1_m + d2_m
    if total <= 0 or d1_m < 0 or d2_m < 0:
        return 0.0
    return math.sqrt(wavelength_m * d1_m * d2_m / total)


def estimate_diffraction_loss(
    max_obstruction_m: float, fresnel_radius_at_obstruction_m: float
) -> float:
    """Estimate additional path loss from terrain obstruction.

    Uses the knife-edge diffraction approximation. The Fresnel-Kirchhoff
    parameter v = sqrt(2) * h / F1 where h is the obstruction height above
    LOS and F1 is the first Fresnel zone radius.

    Simplified model:
    - v <= 0: no additional loss (clear LOS)
    - 0 < v <= 1: 6 + 9*v + 1.27*v^2 dB (ITU-R P.526 approximation)
    - v > 1: 13 + 20*log10(v) dB

    Args:
        max_obstruction_m: How far terrain protrudes above LOS line (positive = obstructed).
        fresnel_radius_at_obstruction_m: Fresnel zone radius at the obstruction point.

    Returns:
        Estimated additional loss in dB (0 if no obstruction).
    """
    if max_obstruction_m <= 0 or fresnel_radius_at_obstruction_m <= 0:
        return 0.0

    v = math.sqrt(2) * max_obstruction_m / fresnel_radius_at_obstruction_m

    if v <= 1:
        return 6.0 + 9.0 * v + 1.27 * v * v
    else:
        return 13.0 + 20.0 * math.log10(v)


def analyze_link(
    node_a: NodeParams,
    node_b: NodeParams,
    read_elevation_fn: Callable[[float, float], Optional[int]],
    num_samples: int = 100,
) -> LinkAnalysisResult:
    """Perform comprehensive link analysis between two nodes.

    Combines terrain profile extraction, Fresnel zone analysis, FSPL
    calculation, and obstruction detection.

    Args:
        node_a: Transmitting node parameters.
        node_b: Receiving node parameters.
        read_elevation_fn: Callable(lat, lon) -> Optional[int] for elevation.
        num_samples: Number of terrain profile samples.

    Returns:
        LinkAnalysisResult with full analysis.
    """
    # Extract terrain profile
    profile = extract_terrain_profile(
        read_elevation_fn=read_elevation_fn,
        lat1=node_a.latitude,
        lon1=node_a.longitude,
        height1_m=node_a.antenna_height_m,
        lat2=node_b.latitude,
        lon2=node_b.longitude,
        height2_m=node_b.antenna_height_m,
        frequency_mhz=node_a.frequency_mhz,
        num_samples=num_samples,
    )

    distance = profile.total_distance_m

    # FSPL calculation
    if distance <= 0:
        return LinkAnalysisResult(
            node_a_id=node_a.node_id,
            node_b_id=node_b.node_id,
            distance_m=0.0,
            profile=profile,
            free_space_loss_db=0.0,
            total_path_loss_db=0.0,
            received_signal_dbm=node_a.erp_dbm,
            link_margin_db=node_a.erp_dbm - node_b.receiver_sensitivity_dbm,
            is_viable=True,
            link_quality="strong",
            has_los=True,
        )

    fsl = fspl_loss_db(distance, node_a.frequency_mhz)

    # Analyze obstructions (skip endpoints — they are the antennas)
    max_obstruction = 0.0
    max_obstruction_fresnel = 0.0
    min_fresnel_clearance_pct = 100.0
    has_los = True

    interior_points = profile.points[1:-1] if len(profile.points) > 2 else []

    for point in interior_points:
        if point.is_obstructed:
            has_los = False
            obstruction_height = point.elevation_m - point.los_height_m
            if obstruction_height > max_obstruction:
                max_obstruction = obstruction_height
                max_obstruction_fresnel = point.fresnel_radius_m

        if point.fresnel_radius_m > 0:
            clearance_above_ground = point.los_height_m - point.elevation_m
            pct = (clearance_above_ground / point.fresnel_radius_m) * 100.0
            if pct < min_fresnel_clearance_pct:
                min_fresnel_clearance_pct = pct

    # Estimate diffraction loss from obstruction
    additional_loss = estimate_diffraction_loss(max_obstruction, max_obstruction_fresnel)
    total_path_loss = fsl + additional_loss

    # Link budget
    received_signal = (
        node_a.tx_power_dbm
        + node_a.antenna_gain_dbi
        - node_a.cable_loss_db
        - total_path_loss
        + node_b.antenna_gain_dbi
        - node_b.cable_loss_db
    )

    link_margin = received_signal - node_b.receiver_sensitivity_dbm
    is_viable = link_margin >= 0

    if link_margin >= 10:
        quality = "strong"
    elif link_margin >= 3:
        quality = "marginal"
    else:
        quality = "weak"

    return LinkAnalysisResult(
        node_a_id=node_a.node_id,
        node_b_id=node_b.node_id,
        distance_m=distance,
        profile=profile,
        free_space_loss_db=fsl,
        total_path_loss_db=total_path_loss,
        received_signal_dbm=received_signal,
        link_margin_db=link_margin,
        is_viable=is_viable,
        link_quality=quality,
        has_los=has_los,
        max_obstruction_m=max_obstruction,
        fresnel_clearance_pct=min_fresnel_clearance_pct,
        estimated_additional_loss_db=additional_loss,
    )


def generate_fresnel_zone_boundary(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    height1_m: float,
    height2_m: float,
    frequency_mhz: float,
    num_points: int = 50,
    read_elevation_fn: Callable[[float, float], Optional[int]] | None = None,
) -> dict:
    """Generate Fresnel zone boundary coordinates for map overlay visualization.

    Returns upper/lower/center coordinate arrays that the frontend can render
    as a translucent 3D volume on the map.

    Args:
        lat1, lon1: Start node position (decimal degrees).
        lat2, lon2: End node position (decimal degrees).
        height1_m: Start node antenna height above ground (m).
        height2_m: End node antenna height above ground (m).
        frequency_mhz: Operating frequency in MHz.
        num_points: Number of sample points along the path.
        read_elevation_fn: Optional terrain elevation reader. Defaults to 0 m.

    Returns:
        Dict with keys:
        - "upper": list of dicts with latitude, longitude, altitude_m, fresnel_radius_m
        - "lower": list of dicts with latitude, longitude, altitude_m, fresnel_radius_m
        - "center": list of dicts with latitude, longitude, altitude_m, fresnel_radius_m
        - "clearance_pct": minimum Fresnel zone clearance percentage along the path
    """
    if num_points < 2:
        num_points = 2

    total_distance = haversine_distance_m(lat1, lon1, lat2, lon2)
    coords = interpolate_coordinates(lat1, lon1, lat2, lon2, num_points)
    wavelength_m = C / (frequency_mhz * 1e6)

    def _elev(lat: float, lon: float) -> float:
        if read_elevation_fn is not None:
            val = read_elevation_fn(lat, lon)
            return float(val) if val is not None else 0.0
        return 0.0

    elev_a = _elev(lat1, lon1)
    elev_b = _elev(lat2, lon2)
    tip_a = elev_a + height1_m
    tip_b = elev_b + height2_m

    upper: list[dict] = []
    lower: list[dict] = []
    center: list[dict] = []
    min_clearance_pct = 100.0

    for i, (lat, lon) in enumerate(coords):
        t = i / (num_points - 1) if num_points > 1 else 0.0
        d1 = t * total_distance
        d2 = total_distance - d1

        los_alt = tip_a + t * (tip_b - tip_a)
        fr = fresnel_zone_radius(wavelength_m, d1, d2)

        ground_elev = _elev(lat, lon)
        clearance_above_ground = los_alt - ground_elev
        if fr > 0:
            pct = (clearance_above_ground / fr) * 100.0
            if pct < min_clearance_pct:
                min_clearance_pct = pct

        center.append({
            "latitude": lat,
            "longitude": lon,
            "altitude_m": los_alt,
            "fresnel_radius_m": fr,
        })
        upper.append({
            "latitude": lat,
            "longitude": lon,
            "altitude_m": los_alt + fr,
            "fresnel_radius_m": fr,
        })
        lower.append({
            "latitude": lat,
            "longitude": lon,
            "altitude_m": los_alt - fr,
            "fresnel_radius_m": fr,
        })

    return {
        "upper": upper,
        "lower": lower,
        "center": center,
        "clearance_pct": min_clearance_pct,
    }


def compute_link_summary(links: list[LinkAnalysisResult]) -> dict:
    """Compute aggregate statistics across a list of link analysis results.

    Returns a dict with total/viable/non-viable counts, margin statistics,
    distance statistics, quality distribution, and LOS/Fresnel metrics.
    """
    if not links:
        return {
            "total_links": 0,
            "viable_links": 0,
            "non_viable_links": 0,
            "viability_pct": 0.0,
            "avg_link_margin_db": 0.0,
            "min_link_margin_db": 0.0,
            "max_link_margin_db": 0.0,
            "avg_distance_m": 0.0,
            "min_distance_m": 0.0,
            "max_distance_m": 0.0,
            "total_cable_m": 0.0,
            "los_count": 0,
            "nlos_count": 0,
            "max_obstruction_m": 0.0,
            "min_fresnel_clearance_pct": 0.0,
            "avg_fresnel_clearance_pct": 0.0,
            "quality_distribution": {},
        }

    n = len(links)
    viable = sum(1 for lk in links if lk.is_viable)
    margins = [lk.link_margin_db for lk in links]
    distances = [lk.distance_m for lk in links]
    fresnel_vals = [lk.fresnel_clearance_pct for lk in links]

    quality_dist: dict[str, int] = {}
    for lk in links:
        quality_dist[lk.link_quality] = quality_dist.get(lk.link_quality, 0) + 1

    los_count = sum(1 for lk in links if lk.has_los)
    max_obs = max(lk.max_obstruction_m for lk in links)

    return {
        "total_links": n,
        "viable_links": viable,
        "non_viable_links": n - viable,
        "viability_pct": round(viable / n * 100, 1),
        "avg_link_margin_db": round(sum(margins) / n, 2),
        "min_link_margin_db": min(margins),
        "max_link_margin_db": max(margins),
        "avg_distance_m": round(sum(distances) / n, 2),
        "min_distance_m": min(distances),
        "max_distance_m": max(distances),
        "total_cable_m": sum(distances),
        "los_count": los_count,
        "nlos_count": n - los_count,
        "max_obstruction_m": max_obs,
        "min_fresnel_clearance_pct": min(fresnel_vals),
        "avg_fresnel_clearance_pct": round(sum(fresnel_vals) / n, 2),
        "quality_distribution": quality_dist,
    }
