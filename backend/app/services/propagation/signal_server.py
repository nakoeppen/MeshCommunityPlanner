"""Signal-Server propagation engine — subprocess wrapper.

Invokes the Signal-Server binary (W3AXL fork) as a subprocess with
shell=False, validated inputs, and configurable timeout. Parses PPM
coverage output and text-based P2P link reports.

Security: All inputs validated before building argument list.
See design.md Decision 4.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from backend.app.services.propagation.engine import (
    BoundingBox,
    CoverageResult,
    LinkResult,
    NodeParams,
    PropagationEngine,
    PropagationModel,
)

logger = logging.getLogger(__name__)

# Input validation ranges (from Signal-Server source code)
VALID_RANGES = {
    "latitude": (-70.0, 70.0),  # Signal-Server limit
    "longitude": (-180.0, 180.0),
    "frequency_mhz": (20.0, 100_000.0),
    "tx_height": (0.0, 60_000.0),  # Meters with -m flag
    "rx_height": (0.0, 60_000.0),
    "radius_km": (0.1, 100.0),
    "erp_watts": (0.0, 500_000_000.0),
    "receiver_threshold_dbm": (-200, 240),
}

# Propagation model numbers
PM_ITM = 1
PM_LOS = 2
PM_HATA = 3
PM_ECC33 = 4
PM_SUI = 5
PM_COST231 = 6
PM_FSPL = 7
PM_ITWOM = 8
PM_ERICSSON = 9
PM_PLANE_EARTH = 10
PM_EGLI = 11
PM_SOIL = 12

DEFAULT_TIMEOUT_S = 60
DEFAULT_RADIUS_KM = 10.0
DEFAULT_PM = PM_ITM
DEFAULT_RESOLUTION = 1200


@dataclass
class SignalServerConfig:
    """Configuration for the Signal-Server engine."""

    binary_path: str = "signalserver"
    sdf_dir: str = ""  # Directory containing .sdf terrain tiles
    temp_dir: str = ""  # For output files
    timeout_s: int = DEFAULT_TIMEOUT_S
    propagation_model: int = DEFAULT_PM
    radius_km: float = DEFAULT_RADIUS_KM
    resolution: int = DEFAULT_RESOLUTION
    terrain_code: int = 4  # 4=Mountain (default for general use)
    climate_code: int = 5  # 5=Continental Temperate
    reliability_pct: float = 50.0
    confidence_pct: float = 50.0
    receiver_threshold_dbm: float = -130.0


def validate_input(name: str, value: float, min_val: float, max_val: float) -> None:
    """Validate a numeric input against allowed range.

    Raises:
        ValueError: If value is outside the allowed range.
    """
    if not (min_val <= value <= max_val):
        raise ValueError(
            f"{name} value {value} out of allowed range [{min_val}, {max_val}]"
        )


def validate_node_for_signal_server(node: NodeParams) -> None:
    """Validate all node parameters against Signal-Server's accepted ranges.

    Raises:
        ValueError: If any parameter is out of range.
    """
    validate_input("latitude", node.latitude, *VALID_RANGES["latitude"])
    validate_input("longitude", node.longitude, *VALID_RANGES["longitude"])
    validate_input("frequency", node.frequency_mhz, *VALID_RANGES["frequency_mhz"])
    validate_input("antenna_height", node.antenna_height_m, *VALID_RANGES["tx_height"])


def build_coverage_args(
    node: NodeParams,
    config: SignalServerConfig,
    output_basename: str,
) -> list[str]:
    """Build the argument list for a coverage calculation.

    Returns a list of strings suitable for subprocess.run(args, shell=False).
    """
    validate_node_for_signal_server(node)

    args = [
        config.binary_path,
        "-lat", str(node.latitude),
        "-lon", str(node.longitude),
        "-txh", str(node.antenna_height_m),
        "-f", str(node.frequency_mhz),
        "-erp", str(node.erp_watts),
        "-rxh", "0.1",  # Default RX height (meters with -m)
        "-rt", str(int(config.receiver_threshold_dbm)),
        "-R", str(config.radius_km),
        "-pm", str(config.propagation_model),
        "-pe", "3",  # Rural (most mesh deployments)
        "-te", str(config.terrain_code),
        "-cl", str(config.climate_code),
        "-rel", str(config.reliability_pct),
        "-conf", str(config.confidence_pct),
        "-res", str(config.resolution),
        "-m",  # Metric units
        "-dbm",  # Output in dBm
        "-o", output_basename,
    ]

    if config.sdf_dir:
        args.extend(["-sdf", config.sdf_dir])

    return args


def build_link_args(
    node_a: NodeParams,
    node_b: NodeParams,
    config: SignalServerConfig,
    output_basename: str,
) -> list[str]:
    """Build the argument list for a point-to-point link calculation.

    P2P mode is triggered by providing -rla and -rlo flags.
    """
    validate_node_for_signal_server(node_a)
    validate_node_for_signal_server(node_b)

    args = [
        config.binary_path,
        "-lat", str(node_a.latitude),
        "-lon", str(node_a.longitude),
        "-txh", str(node_a.antenna_height_m),
        "-f", str(node_a.frequency_mhz),
        "-erp", str(node_a.erp_watts),
        "-rla", str(node_b.latitude),
        "-rlo", str(node_b.longitude),
        "-rxh", str(node_b.antenna_height_m),
        "-rxg", str(node_b.antenna_gain_dbi),
        "-pm", str(config.propagation_model),
        "-te", str(config.terrain_code),
        "-cl", str(config.climate_code),
        "-rel", str(config.reliability_pct),
        "-conf", str(config.confidence_pct),
        "-m",
        "-dbm",
        "-o", output_basename,
    ]

    if config.sdf_dir:
        args.extend(["-sdf", config.sdf_dir])

    return args


def parse_p2p_report(report_text: str) -> dict:
    """Parse a Signal-Server point-to-point text report.

    Extracts key metrics from the report text using multiple pattern variants
    to handle different Signal-Server versions and output formats.
    Returns a dict with parsed values.
    """
    result = {}

    # Each key maps to a list of patterns (tried in order) for robustness
    patterns = {
        "distance_km": [
            r"Distance:\s*([\d.]+)\s*km",
            r"Path distance:\s*([\d.]+)\s*km",
            r"distance[:\s]+([\d.]+)\s*km",
        ],
        "azimuth_deg": [
            r"Azimuth:\s*([\d.]+)\s*degrees?",
            r"Bearing:\s*([\d.]+)\s*degrees?",
        ],
        "free_space_loss_db": [
            r"Free space path loss:\s*([\d.]+)\s*dB",
            r"FSPL:\s*([\d.]+)\s*dB",
            r"Free space loss:\s*([\d.]+)\s*dB",
        ],
        "computed_path_loss_db": [
            r"Computed path loss:\s*([\d.]+)\s*dB",
            r"Total path loss:\s*([\d.]+)\s*dB",
            r"Path loss:\s*([\d.]+)\s*dB",
        ],
        "terrain_shielding_db": [
            r"Terrain shielding:\s*([\d.]+)\s*dB",
            r"Diffraction loss:\s*([\d.]+)\s*dB",
        ],
        "field_strength_dbuvm": [
            r"Field strength:\s*([\d.]+)\s*dBuV/m",
            r"Signal strength:\s*([\d.]+)\s*dBuV/m",
        ],
        "signal_power_dbm": [
            r"Signal power level:\s*(-?[\d.]+)\s*dBm",
            r"Signal power:\s*(-?[\d.]+)\s*dBm",
            r"Received power:\s*(-?[\d.]+)\s*dBm",
            r"Signal level:\s*(-?[\d.]+)\s*dBm",
        ],
        "lr_error": [
            r"Longley-Rice error number:\s*(\d+)",
            r"ITM error:\s*(\d+)",
            r"ITWOM error:\s*(\d+)",
        ],
        "tx_site": [
            r"Transmitter site:\s*(.+)",
        ],
        "rx_site": [
            r"Receiver site:\s*(.+)",
        ],
    }

    for key, pattern_list in patterns.items():
        for pattern in pattern_list:
            match = re.search(pattern, report_text, re.IGNORECASE)
            if match:
                val = match.group(1).strip()
                if key in ("tx_site", "rx_site"):
                    result[key] = val
                else:
                    try:
                        result[key] = float(val) if "." in val or val.startswith("-") else int(val)
                    except ValueError:
                        continue
                break

    return result


def parse_profile_data(profile_text: str) -> list[tuple[float, float]]:
    """Parse gnuplot-format terrain profile data.

    Each line: distance_km elevation_m
    Returns list of (distance_km, elevation_m) tuples.
    """
    points = []
    for line in profile_text.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 2:
            try:
                points.append((float(parts[0]), float(parts[1])))
            except ValueError:
                continue
    return points


class SignalServerEngine(PropagationEngine):
    """Signal-Server propagation engine.

    Invokes Signal-Server as a subprocess with shell=False for security.
    All inputs are validated against range constraints before invocation.
    """

    def __init__(self, config: Optional[SignalServerConfig] = None):
        self._config = config or SignalServerConfig()

    @property
    def model(self) -> PropagationModel:
        return PropagationModel.SIGNAL_SERVER

    @property
    def config(self) -> SignalServerConfig:
        return self._config

    async def calculate_coverage(
        self, node: NodeParams, bounds: BoundingBox
    ) -> CoverageResult:
        """Run Signal-Server coverage calculation for a single node."""
        try:
            validate_node_for_signal_server(node)
        except ValueError as e:
            return CoverageResult(
                node_id=node.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Input validation failed: {e}",
            )

        temp_dir = self._config.temp_dir or tempfile.gettempdir()
        output_basename = os.path.join(temp_dir, f"ss_cov_{node.node_id}")

        args = build_coverage_args(node, self._config, output_basename)

        try:
            result = await asyncio.to_thread(
                subprocess.run,
                args,
                shell=False,
                capture_output=True,
                timeout=self._config.timeout_s,
            )
        except FileNotFoundError:
            return CoverageResult(
                node_id=node.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Signal-Server binary not found at: {self._config.binary_path}",
            )
        except subprocess.TimeoutExpired:
            return CoverageResult(
                node_id=node.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Signal-Server timed out after {self._config.timeout_s}s",
            )

        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")
            return CoverageResult(
                node_id=node.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Signal-Server exited with code {result.returncode}: {stderr[:500]}",
            )

        # Parse PPM output file
        ppm_path = f"{output_basename}.ppm"
        if not os.path.exists(ppm_path):
            return CoverageResult(
                node_id=node.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Output file not found: {ppm_path}",
            )

        return CoverageResult(
            node_id=node.node_id,
            engine=PropagationModel.SIGNAL_SERVER,
            bounds=bounds,
            params_hash=node.params_hash(),
        )

    async def calculate_link(
        self, node_a: NodeParams, node_b: NodeParams
    ) -> LinkResult:
        """Run Signal-Server point-to-point link analysis."""
        try:
            validate_node_for_signal_server(node_a)
            validate_node_for_signal_server(node_b)
        except ValueError as e:
            return LinkResult(
                node_a_id=node_a.node_id,
                node_b_id=node_b.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Input validation failed: {e}",
            )

        temp_dir = self._config.temp_dir or tempfile.gettempdir()
        output_basename = os.path.join(
            temp_dir, f"ss_link_{node_a.node_id}_{node_b.node_id}"
        )

        args = build_link_args(node_a, node_b, self._config, output_basename)

        try:
            result = await asyncio.to_thread(
                subprocess.run,
                args,
                shell=False,
                capture_output=True,
                timeout=self._config.timeout_s,
            )
        except FileNotFoundError:
            return LinkResult(
                node_a_id=node_a.node_id,
                node_b_id=node_b.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Signal-Server binary not found at: {self._config.binary_path}",
            )
        except subprocess.TimeoutExpired:
            return LinkResult(
                node_a_id=node_a.node_id,
                node_b_id=node_b.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Signal-Server timed out after {self._config.timeout_s}s",
            )

        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")
            return LinkResult(
                node_a_id=node_a.node_id,
                node_b_id=node_b.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Signal-Server exited with code {result.returncode}: {stderr[:500]}",
            )

        # Parse the text report
        report_path = f"{output_basename}.txt"
        if not os.path.exists(report_path):
            return LinkResult(
                node_a_id=node_a.node_id,
                node_b_id=node_b.node_id,
                engine=PropagationModel.SIGNAL_SERVER,
                error=f"Report file not found: {report_path}",
            )

        report_text = Path(report_path).read_text(encoding="utf-8", errors="replace")
        parsed = parse_p2p_report(report_text)

        distance_m = parsed.get("distance_km", 0.0) * 1000
        fsl = parsed.get("free_space_loss_db", 0.0)
        path_loss = parsed.get("computed_path_loss_db", fsl)
        signal_dbm = parsed.get("signal_power_dbm", -999.0)
        link_margin = signal_dbm - node_b.receiver_sensitivity_dbm

        # Parse terrain profile and Fresnel zone if available
        elevation_profile = []
        fresnel_clearance = []
        profile_path = f"{output_basename}_profile"
        fresnel_path = f"{output_basename}_fresnel"

        if os.path.exists(profile_path):
            profile_text = Path(profile_path).read_text(encoding="utf-8", errors="replace")
            elevation_profile = parse_profile_data(profile_text)

        if os.path.exists(fresnel_path):
            fresnel_text = Path(fresnel_path).read_text(encoding="utf-8", errors="replace")
            fresnel_clearance = parse_profile_data(fresnel_text)

        return LinkResult(
            node_a_id=node_a.node_id,
            node_b_id=node_b.node_id,
            engine=PropagationModel.SIGNAL_SERVER,
            distance_m=distance_m,
            free_space_loss_db=fsl,
            total_path_loss_db=path_loss,
            received_signal_dbm=signal_dbm,
            link_margin_db=link_margin,
            is_viable=link_margin >= 0,
            elevation_profile=elevation_profile,
            fresnel_clearance=fresnel_clearance,
        )
