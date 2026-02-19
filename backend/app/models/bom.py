"""
Pydantic models for BOM (Bill of Materials) entities.

Models:
- BOMItem: Individual line item in a bill of materials
- NodeBOM: BOM for a single node with all components
- PlanBOM: Aggregated BOM for entire plan with consolidated quantities
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class BOMItem(BaseModel):
    """Individual line item in a bill of materials."""

    category: str = Field(
        ...,
        description="Item category: device, antenna, cable, pa_module, battery, solar_panel, bec, charge_controller, enclosure, mast, connector, misc_hardware"
    )
    item_id: str = Field(..., description="Catalog item ID")
    name: str = Field(..., description="Item name")
    description: Optional[str] = Field(None, description="Item description")
    quantity: int = Field(..., gt=0, description="Quantity required")
    unit_price_usd: Optional[float] = Field(None, ge=0.0, description="Price per unit in USD")
    total_price_usd: Optional[float] = Field(None, ge=0.0, description="Total price (quantity × unit_price)")
    notes: Optional[str] = Field(None, description="Additional notes")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "category": "device",
                    "item_id": "tbeam-supreme",
                    "name": "T-Beam Supreme",
                    "description": "ESP32-S3 based LoRa device with GPS",
                    "quantity": 1,
                    "unit_price_usd": 89.99,
                    "total_price_usd": 89.99,
                    "notes": "Main device"
                }
            ]
        }
    }


class NodeBOM(BaseModel):
    """Bill of materials for a single node."""

    node_id: str = Field(..., description="Node UUID")
    node_name: str = Field(..., description="Node name")
    items: List[BOMItem] = Field(..., description="List of BOM items for this node")
    total_price_usd: float = Field(..., ge=0.0, description="Total cost for this node")
    power_budget_mah_per_day: Optional[float] = Field(
        None,
        ge=0.0,
        description="Estimated power consumption in mAh per day"
    )
    is_solar: bool = Field(default=False, description="True if node has solar power")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "node_id": "550e8400-e29b-41d4-a716-446655440000",
                    "node_name": "Hilltop Repeater",
                    "items": [
                        {
                            "category": "device",
                            "item_id": "tbeam-supreme",
                            "name": "T-Beam Supreme",
                            "quantity": 1,
                            "unit_price_usd": 89.99,
                            "total_price_usd": 89.99
                        },
                        {
                            "category": "antenna",
                            "item_id": "915-3dbi-omni",
                            "name": "915 MHz 3 dBi Omni",
                            "quantity": 1,
                            "unit_price_usd": 12.50,
                            "total_price_usd": 12.50
                        }
                    ],
                    "total_price_usd": 102.49,
                    "power_budget_mah_per_day": 250.0,
                    "is_solar": True
                }
            ]
        }
    }


class PlanBOM(BaseModel):
    """Aggregated bill of materials for an entire plan."""

    plan_id: str = Field(..., description="Plan UUID")
    plan_name: str = Field(..., description="Plan name")
    node_boms: List[NodeBOM] = Field(..., description="Per-node BOMs")
    consolidated_items: List[BOMItem] = Field(
        ...,
        description="Consolidated items with aggregated quantities across all nodes"
    )
    total_price_usd: float = Field(..., ge=0.0, description="Total cost for entire plan")
    node_count: int = Field(..., ge=0, description="Number of nodes in plan")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "plan_id": "660e8400-e29b-41d4-a716-446655440000",
                    "plan_name": "Downtown Mesh Network",
                    "node_boms": [
                        {
                            "node_id": "node1",
                            "node_name": "Node 1",
                            "items": [
                                {
                                    "category": "device",
                                    "item_id": "tbeam",
                                    "name": "T-Beam",
                                    "quantity": 1,
                                    "unit_price_usd": 80.0,
                                    "total_price_usd": 80.0
                                }
                            ],
                            "total_price_usd": 80.0,
                            "is_solar": False
                        }
                    ],
                    "consolidated_items": [
                        {
                            "category": "device",
                            "item_id": "tbeam",
                            "name": "T-Beam",
                            "quantity": 7,
                            "unit_price_usd": 80.0,
                            "total_price_usd": 560.0
                        }
                    ],
                    "total_price_usd": 1200.50,
                    "node_count": 7
                }
            ]
        }
    }
