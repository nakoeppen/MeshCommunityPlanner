"""Abstract base class for propagation engines.

Implements the Strategy pattern (design.md Decision 3). All propagation
engines share a common interface so the backend can swap engines at runtime
based on user selection.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections.abc import Callable
from typing import Optional


class PropagationModel(str, Enum):
    """Supported propagation models."""

    FSPL = "fspl"
    SIGNAL_SERVER = "signal_server"
    RADIO_MOBILE = "radio_mobile"


@dataclass(frozen=True)
class NodeParams:
    """Parameters describing a single node for propagation calculations."""

    node_id: str
    latitude: float  # -90 to 90
    longitude: float  # -180 to 180
    antenna_height_m: float  # 0 to 500
    frequency_mhz: float  # 137 to 1020
    tx_power_dbm: float  # 0 to 30
    antenna_gain_dbi: float  # dBi
    cable_loss_db: float  # total cable loss in dB (>= 0)
    receiver_sensitivity_dbm: float  # e.g. -130 for Long/Fast

    def __post_init__(self) -> None:
        if not (-90 <= self.latitude <= 90):
            raise ValueError(f"Latitude {self.latitude} out of range [-90, 90]")
        if not (-180 <= self.longitude <= 180):
            raise ValueError(f"Longitude {self.longitude} out of range [-180, 180]")
        if not (0 <= self.antenna_height_m <= 500):
            raise ValueError(
                f"Antenna height {self.antenna_height_m} out of range [0, 500]"
            )
        if not (137 <= self.frequency_mhz <= 1020):
            raise ValueError(
                f"Frequency {self.frequency_mhz} out of range [137, 1020]"
            )
        if not (0 <= self.tx_power_dbm <= 30):
            raise ValueError(
                f"TX power {self.tx_power_dbm} out of range [0, 30]"
            )
        if self.cable_loss_db < 0:
            raise ValueError(f"Cable loss {self.cable_loss_db} must be >= 0")

    @property
    def erp_dbm(self) -> float:
        """Effective Radiated Power in dBm."""
        return self.tx_power_dbm + self.antenna_gain_dbi - self.cable_loss_db

    @property
    def erp_watts(self) -> float:
        """Effective Radiated Power in Watts."""
        return 10 ** ((self.erp_dbm - 30) / 10)

    def params_hash(self) -> str:
        """SHA-256 hash of all parameters for cache key generation.

        Cached on first call since NodeParams is frozen (immutable).
        """
        try:
            return self._cached_hash  # type: ignore[attr-defined]
        except AttributeError:
            data = json.dumps(asdict(self), sort_keys=True)
            h = hashlib.sha256(data.encode()).hexdigest()
            object.__setattr__(self, "_cached_hash", h)
            return h


@dataclass(frozen=True)
class BoundingBox:
    """Geographic bounding box for coverage calculations."""

    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float

    def __post_init__(self) -> None:
        if self.min_lat >= self.max_lat:
            raise ValueError("min_lat must be less than max_lat")
        if self.min_lon >= self.max_lon:
            raise ValueError("min_lon must be less than max_lon")


@dataclass
class CoverageResult:
    """Result from a coverage calculation."""

    node_id: str
    engine: PropagationModel
    # Grid of signal strength values (dBm) — row-major, south-to-north
    signal_grid: list[list[float]] = field(default_factory=list)
    # Bounding box of the grid
    bounds: Optional[BoundingBox] = None
    # Grid dimensions
    grid_rows: int = 0
    grid_cols: int = 0
    # Coverage radius in meters (for FSPL circle-based results)
    coverage_radius_m: Optional[float] = None
    # Metadata
    params_hash: str = ""
    error: Optional[str] = None

    @property
    def is_error(self) -> bool:
        return self.error is not None


@dataclass
class LinkResult:
    """Result from a point-to-point link calculation."""

    node_a_id: str
    node_b_id: str
    engine: PropagationModel
    distance_m: float = 0.0
    free_space_loss_db: float = 0.0
    total_path_loss_db: float = 0.0
    received_signal_dbm: float = 0.0
    link_margin_db: float = 0.0
    is_viable: bool = False
    # Terrain profile data (for P2P mode)
    elevation_profile: list[tuple[float, float]] = field(default_factory=list)
    fresnel_clearance: list[tuple[float, float]] = field(default_factory=list)
    obstructions: list[dict] = field(default_factory=list)
    error: Optional[str] = None

    @property
    def is_error(self) -> bool:
        return self.error is not None

    @property
    def link_quality(self) -> str:
        """Classify link quality: strong, marginal, or weak."""
        if self.link_margin_db >= 10:
            return "strong"
        elif self.link_margin_db >= 3:
            return "marginal"
        else:
            return "weak"


class PropagationEngine(ABC):
    """Abstract base class for all propagation engines.

    Subclasses implement the Strategy pattern:
    - FSPLEngine: pure math, no external deps, instant preview
    - SignalServerEngine: subprocess, terrain-aware, uses SRTM/SDF
    - RadioMobileEngine: stub (not yet implemented)
    """

    @property
    @abstractmethod
    def model(self) -> PropagationModel:
        """Return the propagation model identifier."""
        ...

    @abstractmethod
    async def calculate_coverage(
        self, node: NodeParams, bounds: BoundingBox
    ) -> CoverageResult:
        """Calculate coverage for a single node within a bounding box.

        Args:
            node: Node parameters (location, frequency, power, etc.)
            bounds: Geographic area to calculate coverage for.

        Returns:
            CoverageResult with signal grid or coverage radius.
        """
        ...

    @abstractmethod
    async def calculate_link(
        self, node_a: NodeParams, node_b: NodeParams
    ) -> LinkResult:
        """Calculate point-to-point link between two nodes.

        Args:
            node_a: First node parameters.
            node_b: Second node parameters.

        Returns:
            LinkResult with path loss, signal strength, margin, viability.
        """
        ...


async def calculate_all_links(
    engine: PropagationEngine,
    nodes: list[NodeParams],
    max_concurrency: int = 4,
    progress_callback: Optional[Callable[[int, int, LinkResult], None]] = None,
) -> list[LinkResult]:
    """Calculate links for all unique node pairs with concurrency control.

    Args:
        engine: Propagation engine to use.
        nodes: List of nodes to compute all pairwise links for.
        max_concurrency: Maximum concurrent link calculations.
        progress_callback: Optional (completed, total, result) callback.

    Returns:
        List of LinkResult for each unique pair (i, j) where i < j.
    """
    pairs = [
        (nodes[i], nodes[j])
        for i in range(len(nodes))
        for j in range(i + 1, len(nodes))
    ]

    if not pairs:
        return []

    semaphore = asyncio.Semaphore(max_concurrency)
    results: list[LinkResult] = []
    completed = 0

    async def _calc(node_a: NodeParams, node_b: NodeParams) -> LinkResult:
        nonlocal completed
        async with semaphore:
            result = await engine.calculate_link(node_a, node_b)
        completed += 1
        if progress_callback:
            progress_callback(completed, len(pairs), result)
        return result

    tasks = [_calc(a, b) for a, b in pairs]
    results = await asyncio.gather(*tasks)
    return list(results)
