"""
Pydantic models for Settings and Activity Log entities.

Models:
- SettingsUpdate: Request model for updating user preferences
- StorageUsage: Response model for cache storage statistics
- ActivityLogEntry: Response model for external API activity log entries
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SettingsUpdate(BaseModel):
    """Request model for updating user preferences (all fields optional)."""

    unit_system: Optional[str] = Field(None, description="Unit system: metric or imperial")
    color_palette: Optional[str] = Field(
        None,
        description="Color palette: viridis, cividis, deuteranopia, protanopia, tritanopia, high_contrast"
    )
    map_cache_limit_mb: Optional[int] = Field(None, gt=0, description="Map tile cache limit in MB")
    terrain_cache_limit_mb: Optional[int] = Field(None, gt=0, description="SRTM terrain cache limit in MB")
    total_cache_limit_mb: Optional[int] = Field(None, gt=0, description="Total cache limit in MB")
    sun_hours_peak: Optional[float] = Field(None, gt=0.0, description="Peak sun hours per day for solar calculations")
    battery_autonomy_days: Optional[int] = Field(None, gt=0, description="Desired battery autonomy in days")
    signal_server_concurrency: Optional[int] = Field(
        None,
        gt=0,
        description="Maximum concurrent Signal-Server processes"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "unit_system": "metric",
                    "color_palette": "viridis",
                    "map_cache_limit_mb": 500,
                    "terrain_cache_limit_mb": 1000,
                    "total_cache_limit_mb": 2000,
                    "sun_hours_peak": 4.5,
                    "battery_autonomy_days": 3,
                    "signal_server_concurrency": 2
                }
            ]
        }
    }


class StorageUsage(BaseModel):
    """Response model for cache storage statistics."""

    map_tiles_mb: float = Field(..., ge=0.0, description="Map tiles cache size in MB")
    map_tiles_limit_mb: int = Field(..., gt=0, description="Map tiles cache limit in MB")
    terrain_srtm_mb: float = Field(..., ge=0.0, description="SRTM terrain cache size in MB")
    terrain_srtm_limit_mb: int = Field(..., gt=0, description="SRTM terrain cache limit in MB")
    propagation_cache_mb: float = Field(..., ge=0.0, description="Propagation cache size in MB")
    saved_plans_mb: float = Field(..., ge=0.0, description="Saved plans size in MB")
    total_mb: float = Field(..., ge=0.0, description="Total cache size in MB")
    total_limit_mb: int = Field(..., gt=0, description="Total cache limit in MB")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "map_tiles_mb": 250.5,
                    "map_tiles_limit_mb": 500,
                    "terrain_srtm_mb": 450.0,
                    "terrain_srtm_limit_mb": 1000,
                    "propagation_cache_mb": 125.0,
                    "saved_plans_mb": 10.5,
                    "total_mb": 836.0,
                    "total_limit_mb": 2000
                }
            ]
        }
    }


class ActivityLogEntry(BaseModel):
    """Response model for external API activity log entry."""

    id: str = Field(..., description="Log entry UUID")
    timestamp: datetime = Field(..., description="Timestamp of API call")
    destination: str = Field(
        ...,
        description="Destination service: srtm, osm, signal_server"
    )
    action: str = Field(..., description="Action performed: area_coverage, link_analysis, tile_download, etc.")
    data_summary: str = Field(..., description="Summary of data sent (coordinates, frequency, power - no API keys)")
    response_status: Optional[int] = Field(None, description="HTTP response status code")
    response_summary: Optional[str] = Field(None, description="Brief result or error message")
    plan_id: Optional[str] = Field(None, description="Associated plan UUID (null if not plan-specific)")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "examples": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "timestamp": "2026-02-06T15:30:00Z",
                    "destination": "srtm",
                    "action": "tile_download",
                    "data_summary": "SRTM tile N40W075 for terrain elevation data",
                    "response_status": 200,
                    "response_summary": "Coverage calculated successfully",
                    "plan_id": "660e8400-e29b-41d4-a716-446655440000"
                }
            ]
        }
    }
