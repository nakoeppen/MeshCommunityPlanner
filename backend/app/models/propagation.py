"""
Pydantic models for Propagation-related requests and responses.

Models:
- FSPLRequest: Free-space path loss calculation request
- TerrainRequest: Terrain-aware propagation request (single node or full plan)
- LinkRequest: Point-to-point link analysis request
- PropagationResult: Propagation calculation result
- ProgressUpdate: WebSocket progress update message
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class FSPLRequest(BaseModel):
    """Request model for FSPL (Free-Space Path Loss) calculation."""

    frequency_mhz: float = Field(..., ge=137.0, le=1020.0, description="Frequency in MHz")
    tx_power_dbm: float = Field(..., ge=0.0, le=30.0, description="TX power in dBm")
    antenna_gain_dbi: float = Field(default=0.0, description="Antenna gain in dBi")
    cable_loss_db: float = Field(default=0.0, ge=0.0, description="Cable loss in dB")
    receiver_sensitivity_dbm: float = Field(..., description="Receiver sensitivity in dBm")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "frequency_mhz": 906.875,
                    "tx_power_dbm": 22.0,
                    "antenna_gain_dbi": 3.0,
                    "cable_loss_db": 0.5,
                    "receiver_sensitivity_dbm": -130.0
                }
            ]
        }
    }


class TerrainRequest(BaseModel):
    """Request model for terrain-aware propagation calculation."""

    node_id: str = Field(..., description="Node UUID to calculate propagation for")
    engine: str = Field(
        default="signal_server",
        description="Propagation engine to use (signal_server, fspl)"
    )
    bounds: Dict[str, float] = Field(
        ...,
        description="Bounding box: {north, south, east, west} in decimal degrees"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "node_id": "550e8400-e29b-41d4-a716-446655440000",
                    "engine": "signal_server",
                    "bounds": {
                        "north": 41.0,
                        "south": 40.0,
                        "east": -73.0,
                        "west": -74.0
                    }
                }
            ]
        }
    }


class LinkRequest(BaseModel):
    """Request model for point-to-point link analysis."""

    node_a_id: str = Field(..., description="First node UUID")
    node_b_id: str = Field(..., description="Second node UUID")
    engine: str = Field(
        default="signal_server",
        description="Propagation engine to use"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "node_a_id": "550e8400-e29b-41d4-a716-446655440000",
                    "node_b_id": "660e8400-e29b-41d4-a716-446655440000",
                    "engine": "signal_server"
                }
            ]
        }
    }


class PropagationResult(BaseModel):
    """Response model for propagation calculation result."""

    result_id: str = Field(..., description="Result UUID")
    node_id: Optional[str] = Field(None, description="Node UUID (if single-node calculation)")
    engine: str = Field(..., description="Engine used for calculation")
    coverage_radius_m: float = Field(..., gt=0.0, description="Coverage radius in meters")
    grid_data: Optional[str] = Field(
        None,
        description="JSON-encoded coverage grid data (compressed)"
    )
    calculation_time_ms: Optional[float] = Field(None, ge=0.0, description="Calculation time in ms")
    cached: bool = Field(..., description="True if result was retrieved from cache")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "result_id": "770e8400-e29b-41d4-a716-446655440000",
                    "node_id": "550e8400-e29b-41d4-a716-446655440000",
                    "engine": "signal_server",
                    "coverage_radius_m": 5000.0,
                    "grid_data": "{\"type\": \"grid\", \"data\": [[1,2,3]]}",
                    "calculation_time_ms": 1500.0,
                    "cached": False
                }
            ]
        }
    }


class ProgressUpdate(BaseModel):
    """WebSocket message model for propagation progress updates."""

    type: str = Field(..., description="Message type (propagation_progress)")
    job_id: str = Field(..., description="Job UUID")
    status: str = Field(
        ...,
        description="Job status: downloading_terrain, converting_srtm, calculating, complete, error"
    )
    progress: float = Field(..., ge=0.0, le=1.0, description="Progress as decimal (0.0-1.0)")
    message: Optional[str] = Field(None, description="Human-readable status message")
    node_id: Optional[str] = Field(None, description="Current node being processed")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "type": "propagation_progress",
                    "job_id": "880e8400-e29b-41d4-a716-446655440000",
                    "status": "calculating",
                    "progress": 0.45,
                    "message": "Processing node 3 of 7...",
                    "node_id": "550e8400-e29b-41d4-a716-446655440000"
                }
            ]
        }
    }
