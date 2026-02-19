"""
Pydantic models for Hardware catalog entities.

Models for all catalog tables (devices, antennas, cables, PA modules, power components)
and reference tables (regulatory presets, modem presets, firmware region defaults).
Includes Response, Create, and Update models for each.
"""

from typing import Optional, Any, Dict
from pydantic import BaseModel, Field


# ============================================================================
# Response Models
# ============================================================================

class DeviceResponse(BaseModel):
    id: str
    name: str
    mcu: str
    radio_chip: str
    max_tx_power_dbm: float
    frequency_bands: str = Field(..., description="JSON array of frequency bands")
    has_gps: bool
    battery_type: Optional[str] = None
    battery_capacity_mah: Optional[int] = None
    form_factor: Optional[str] = None
    has_bluetooth: bool = False
    has_wifi: bool = False
    price_usd: Optional[float] = None
    compatible_firmware: str = Field(..., description="JSON array of compatible firmware")
    tx_current_ma: Optional[float] = None
    rx_current_ma: Optional[float] = None
    sleep_current_ma: Optional[float] = None
    is_custom: bool
    model_config = {"from_attributes": True}


class AntennaResponse(BaseModel):
    id: str
    name: str
    frequency_band: str
    gain_dbi: float
    polarization: Optional[str] = None
    form_factor: Optional[str] = None
    connector_type: Optional[str] = None
    price_usd: Optional[float] = None
    is_default: bool
    is_custom: bool
    model_config = {"from_attributes": True}


class CableResponse(BaseModel):
    id: str
    name: str
    cable_type: str
    loss_per_m_915mhz: float
    loss_per_m_868mhz: float
    loss_per_m_433mhz: Optional[float] = None
    connector_types: Optional[str] = None
    price_per_m_usd: Optional[float] = None
    is_custom: bool
    model_config = {"from_attributes": True}


class PAModuleResponse(BaseModel):
    id: str
    name: str
    frequency_range: str
    max_output_power_dbm: float
    input_power_range: Optional[str] = None
    current_draw_ma: float
    price_usd: Optional[float] = None
    is_custom: bool
    model_config = {"from_attributes": True}


class PowerComponentResponse(BaseModel):
    id: str
    category: str
    name: str
    specs: str = Field(..., description="JSON object with category-specific specifications")
    price_usd: Optional[float] = None
    is_custom: bool
    model_config = {"from_attributes": True}


class RegulatoryPresetResponse(BaseModel):
    id: str
    name: str
    region_code: str
    min_frequency_mhz: float
    max_frequency_mhz: float
    max_tx_power_dbm: float
    max_erp_dbm: Optional[float] = None
    duty_cycle_pct: float
    bandwidths_khz: str
    model_config = {"from_attributes": True}


class ModemPresetResponse(BaseModel):
    id: str
    name: str
    firmware: str
    spreading_factor: int
    bandwidth_khz: float
    coding_rate: str
    receiver_sensitivity_dbm: float
    is_default: bool = False
    sort_order: int = 0
    model_config = {"from_attributes": True}


class FirmwareRegionDefaultResponse(BaseModel):
    id: str
    firmware: str
    region_code: str
    default_frequency_mhz: float
    default_modem_preset_id: Optional[str] = None
    model_config = {"from_attributes": True}


# ============================================================================
# Create Models
# ============================================================================

class CustomDeviceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    mcu: str
    radio_chip: str
    max_tx_power_dbm: float = Field(..., ge=0.0, le=30.0)
    frequency_bands: str = Field(..., description="JSON array of frequency bands")
    has_gps: bool
    battery_type: Optional[str] = None
    battery_capacity_mah: Optional[int] = Field(None, gt=0)
    form_factor: Optional[str] = None
    has_bluetooth: bool = False
    has_wifi: bool = False
    price_usd: Optional[float] = Field(None, ge=0.0)
    compatible_firmware: str = Field(..., description="JSON array of compatible firmware")
    tx_current_ma: Optional[float] = Field(None, ge=0.0)
    rx_current_ma: Optional[float] = Field(None, ge=0.0)
    sleep_current_ma: Optional[float] = Field(None, ge=0.0)


class AntennaCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    frequency_band: str
    gain_dbi: float
    polarization: Optional[str] = None
    form_factor: Optional[str] = None
    connector_type: Optional[str] = None
    price_usd: Optional[float] = Field(None, ge=0.0)
    is_default: bool = False


class CableCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    cable_type: str
    loss_per_m_915mhz: float
    loss_per_m_868mhz: float
    loss_per_m_433mhz: Optional[float] = None
    connector_types: Optional[str] = None
    price_per_m_usd: Optional[float] = Field(None, ge=0.0)


class PAModuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    frequency_range: str
    max_output_power_dbm: float
    input_power_range: Optional[str] = None
    current_draw_ma: float
    price_usd: Optional[float] = Field(None, ge=0.0)


class PowerComponentCreate(BaseModel):
    category: str = Field(..., description="solar_panel, battery, bec, charge_controller, enclosure, mast, connector")
    name: str = Field(..., min_length=1, max_length=256)
    specs: str = Field(..., description="JSON object with specs")
    price_usd: Optional[float] = Field(None, ge=0.0)


class RegulatoryPresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    region_code: str
    min_frequency_mhz: float
    max_frequency_mhz: float
    max_tx_power_dbm: float
    max_erp_dbm: Optional[float] = None
    duty_cycle_pct: float
    bandwidths_khz: str = Field(..., description="JSON array of bandwidths in kHz")


class ModemPresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    firmware: str
    spreading_factor: int = Field(..., ge=5, le=12)
    bandwidth_khz: float
    coding_rate: str
    receiver_sensitivity_dbm: float
    is_default: bool = False
    sort_order: int = 0


class FirmwareRegionDefaultCreate(BaseModel):
    firmware: str
    region_code: str
    default_frequency_mhz: float
    default_modem_preset_id: Optional[str] = None


# ============================================================================
# Update Model (generic partial update)
# ============================================================================

class CatalogItemUpdate(BaseModel):
    fields: Dict[str, Any] = Field(..., description="Dictionary of field_name: new_value pairs")
