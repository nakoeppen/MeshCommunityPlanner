"""Free-Space Path Loss (FSPL) propagation engine.

Pure math implementation — no external dependencies, no terrain data.
Used for instant coverage preview on node placement (< 500ms target)
and as backend validation reference.

Formula: FSPL(dB) = 20*log10(d_m) + 20*log10(f_Hz) - 147.55
"""

from __future__ import annotations

import math
from typing import Optional

from backend.app.services.propagation.engine import (
    BoundingBox,
    CoverageResult,
    LinkResult,
    NodeParams,
    PropagationEngine,
    PropagationModel,
)

# Speed of light in m/s
C = 299_792_458.0

# FSPL constant: 20*log10(4*pi/c) ≈ -147.55 dB when d in meters, f in Hz
FSPL_CONSTANT_DB = 20 * math.log10(4 * math.pi / C)  # ≈ -147.5552


def fspl_loss_db(distance_m: float, frequency_mhz: float) -> float:
    """Calculate free-space path loss in dB.

    Args:
        distance_m: Distance in meters. Must be > 0.
        frequency_mhz: Frequency in MHz. Must be > 0.

    Returns:
        Path loss in dB (positive value = loss).

    Raises:
        ValueError: If distance or frequency is <= 0.
    """
    if distance_m <= 0:
        raise ValueError(f"Distance must be > 0, got {distance_m}")
    if frequency_mhz <= 0:
        raise ValueError(f"Frequency must be > 0, got {frequency_mhz}")

    frequency_hz = frequency_mhz * 1e6
    # FSPL = 20*log10(d) + 20*log10(f) + 20*log10(4π/c)
    return (
        20 * math.log10(distance_m)
        + 20 * math.log10(frequency_hz)
        + FSPL_CONSTANT_DB
    )


def coverage_radius_m(
    tx_power_dbm: float,
    antenna_gain_dbi: float,
    cable_loss_db: float,
    receiver_sensitivity_dbm: float,
    frequency_mhz: float,
) -> float:
    """Calculate the maximum coverage radius in meters.

    Inverts the FSPL formula to find the distance at which received
    signal equals receiver sensitivity.

    Link budget: rx_signal = tx_power + gain - cable_loss - FSPL
    At threshold:  sensitivity = tx_power + gain - cable_loss - FSPL
    Therefore:     FSPL_max = tx_power + gain - cable_loss - sensitivity

    Then invert:   d = 10^((FSPL - 20*log10(f_Hz) - FSPL_CONSTANT) / 20)

    Args:
        tx_power_dbm: Transmit power in dBm.
        antenna_gain_dbi: Antenna gain in dBi.
        cable_loss_db: Cable loss in dB (positive).
        receiver_sensitivity_dbm: Receiver sensitivity in dBm (negative).
        frequency_mhz: Frequency in MHz.

    Returns:
        Maximum coverage radius in meters.
    """
    if frequency_mhz <= 0:
        raise ValueError(f"Frequency must be > 0, got {frequency_mhz}")

    # Maximum allowable path loss
    max_path_loss_db = tx_power_dbm + antenna_gain_dbi - cable_loss_db - receiver_sensitivity_dbm

    if max_path_loss_db <= 0:
        return 0.0

    frequency_hz = frequency_mhz * 1e6
    # Invert: distance = 10^((FSPL - 20*log10(f_Hz) - FSPL_CONSTANT) / 20)
    log_d = (max_path_loss_db - 20 * math.log10(frequency_hz) - FSPL_CONSTANT_DB) / 20
    return 10**log_d


def haversine_distance_m(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """Calculate great-circle distance between two points using Haversine formula.

    Args:
        lat1, lon1: First point in decimal degrees.
        lat2, lon2: Second point in decimal degrees.

    Returns:
        Distance in meters.
    """
    R = 6_371_000  # Earth's mean radius in meters

    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _precompute_radians(nodes: list[NodeParams]) -> dict[str, tuple[float, float, float]]:
    """Pre-compute trig values for haversine — avoids repeated radians() calls.

    Returns dict mapping node_id → (lat_rad, cos_lat_rad, lon_rad).
    """
    cache: dict[str, tuple[float, float, float]] = {}
    for n in nodes:
        lat_r = math.radians(n.latitude)
        cache[n.node_id] = (lat_r, math.cos(lat_r), math.radians(n.longitude))
    return cache


def _haversine_fast(
    lat1_r: float, cos_lat1: float, lon1_r: float,
    lat2_r: float, cos_lat2: float, lon2_r: float,
) -> float:
    """Haversine with pre-computed radians and cos values.

    Same formula as haversine_distance_m but avoids redundant math.radians()
    and math.cos() calls when iterating over many node pairs.
    """
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = (
        math.sin(dlat / 2) ** 2
        + cos_lat1 * cos_lat2 * math.sin(dlon / 2) ** 2
    )
    return 6_371_000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class FSPLEngine(PropagationEngine):
    """Free-Space Path Loss propagation engine.

    Pure mathematical calculation — no terrain data, no external calls.
    Provides instant (<500ms) coverage estimates for the map preview.
    """

    @property
    def model(self) -> PropagationModel:
        return PropagationModel.FSPL

    async def calculate_coverage(
        self, node: NodeParams, bounds: BoundingBox
    ) -> CoverageResult:
        """Calculate FSPL coverage for a single node.

        Returns a CoverageResult with coverage_radius_m set (circle-based).
        For FSPL we don't generate a full signal grid — just the radius.
        """
        radius = coverage_radius_m(
            tx_power_dbm=node.tx_power_dbm,
            antenna_gain_dbi=node.antenna_gain_dbi,
            cable_loss_db=node.cable_loss_db,
            receiver_sensitivity_dbm=node.receiver_sensitivity_dbm,
            frequency_mhz=node.frequency_mhz,
        )

        return CoverageResult(
            node_id=node.node_id,
            engine=PropagationModel.FSPL,
            coverage_radius_m=radius,
            bounds=bounds,
            params_hash=node.params_hash(),
        )

    async def calculate_link(
        self, node_a: NodeParams, node_b: NodeParams
    ) -> LinkResult:
        """Calculate FSPL link budget between two nodes.

        Uses haversine distance and the FSPL formula. No terrain data.
        """
        distance = haversine_distance_m(
            node_a.latitude, node_a.longitude,
            node_b.latitude, node_b.longitude,
        )

        if distance <= 0:
            # Co-located nodes
            return LinkResult(
                node_a_id=node_a.node_id,
                node_b_id=node_b.node_id,
                engine=PropagationModel.FSPL,
                distance_m=0.0,
                free_space_loss_db=0.0,
                total_path_loss_db=0.0,
                received_signal_dbm=node_a.erp_dbm,
                link_margin_db=node_a.erp_dbm - node_b.receiver_sensitivity_dbm,
                is_viable=True,
            )

        fsl = fspl_loss_db(distance, node_a.frequency_mhz)

        # Received signal: TX power + TX gain - TX cable loss - FSPL + RX gain - RX cable loss
        # Simplified: using node_a as TX and node_b as RX
        received_signal = (
            node_a.tx_power_dbm
            + node_a.antenna_gain_dbi
            - node_a.cable_loss_db
            - fsl
            + node_b.antenna_gain_dbi
            - node_b.cable_loss_db
        )

        link_margin = received_signal - node_b.receiver_sensitivity_dbm
        is_viable = link_margin >= 0

        return LinkResult(
            node_a_id=node_a.node_id,
            node_b_id=node_b.node_id,
            engine=PropagationModel.FSPL,
            distance_m=distance,
            free_space_loss_db=fsl,
            total_path_loss_db=fsl,
            received_signal_dbm=received_signal,
            link_margin_db=link_margin,
            is_viable=is_viable,
        )

    def calculate_links_batch(self, nodes: list[NodeParams]) -> list[LinkResult]:
        """Calculate FSPL links for all unique pairs — optimized for batch use.

        Pre-computes trig values and frequency log to avoid redundant math
        when computing many pairs. ~30-40% faster than calling calculate_link()
        in a loop for large node sets.

        Args:
            nodes: List of nodes (all pairs will be computed).

        Returns:
            List of LinkResult for each unique pair (i, j) where i < j.
        """
        if len(nodes) < 2:
            return []

        # Pre-compute per-node values
        trig = _precompute_radians(nodes)
        freq_logs: dict[float, float] = {}

        results: list[LinkResult] = []

        for i in range(len(nodes)):
            na = nodes[i]
            lat1_r, cos_lat1, lon1_r = trig[na.node_id]

            # Cache frequency log
            if na.frequency_mhz not in freq_logs:
                freq_logs[na.frequency_mhz] = 20 * math.log10(na.frequency_mhz * 1e6)

            for j in range(i + 1, len(nodes)):
                nb = nodes[j]
                lat2_r, cos_lat2, lon2_r = trig[nb.node_id]

                # Fast haversine
                distance = _haversine_fast(
                    lat1_r, cos_lat1, lon1_r,
                    lat2_r, cos_lat2, lon2_r,
                )

                if distance <= 0:
                    results.append(LinkResult(
                        node_a_id=na.node_id,
                        node_b_id=nb.node_id,
                        engine=PropagationModel.FSPL,
                        distance_m=0.0,
                        free_space_loss_db=0.0,
                        total_path_loss_db=0.0,
                        received_signal_dbm=na.erp_dbm,
                        link_margin_db=na.erp_dbm - nb.receiver_sensitivity_dbm,
                        is_viable=True,
                    ))
                    continue

                # FSPL with cached frequency log
                fsl = (
                    20 * math.log10(distance)
                    + freq_logs[na.frequency_mhz]
                    + FSPL_CONSTANT_DB
                )

                received_signal = (
                    na.tx_power_dbm + na.antenna_gain_dbi - na.cable_loss_db
                    - fsl
                    + nb.antenna_gain_dbi - nb.cable_loss_db
                )
                link_margin = received_signal - nb.receiver_sensitivity_dbm

                results.append(LinkResult(
                    node_a_id=na.node_id,
                    node_b_id=nb.node_id,
                    engine=PropagationModel.FSPL,
                    distance_m=distance,
                    free_space_loss_db=fsl,
                    total_path_loss_db=fsl,
                    received_signal_dbm=received_signal,
                    link_margin_db=link_margin,
                    is_viable=link_margin >= 0,
                ))

        return results
