"""
Catalog API endpoints - Full CRUD for hardware catalog and reference tables.

Provides browsing, creation, update, deletion, CSV import/export, and reset
for all catalog tables (devices, antennas, cables, pa_modules, power_components)
and reference tables (regulatory_presets, modem_presets, firmware_region_defaults).
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import PlainTextResponse
from typing import List, Optional
import sqlite3

from backend.app.models.hardware import (
    DeviceResponse, AntennaResponse, CableResponse, PAModuleResponse,
    PowerComponentResponse, RegulatoryPresetResponse, ModemPresetResponse,
    FirmwareRegionDefaultResponse, CustomDeviceCreate, AntennaCreate,
    CableCreate, PAModuleCreate, PowerComponentCreate,
    RegulatoryPresetCreate, ModemPresetCreate, FirmwareRegionDefaultCreate,
    CatalogItemUpdate,
)
from backend.app.db.repositories.catalog_repo import CatalogRepository
from backend.app.db.connection import get_db_connection


router = APIRouter(prefix="/catalog", tags=["catalog"])

# Map URL path segments to DB table names (hardware + reference)
TABLE_MAP = {
    "devices": "devices",
    "antennas": "antennas",
    "cables": "cables",
    "pa-modules": "pa_modules",
    "power": "power_components",
    "regulatory-presets": "regulatory_presets",
    "modem-presets": "modem_presets",
    "firmware-defaults": "firmware_region_defaults",
}


def _resolve_table(table: str) -> str:
    """Resolve URL table segment to DB table name, or raise 400."""
    db_table = TABLE_MAP.get(table)
    if not db_table:
        raise HTTPException(status_code=400, detail=f"Unknown table: {table}")
    return db_table


# ============================================================================
# Catalog Read Endpoints (specific paths BEFORE parameterized paths)
# ============================================================================

@router.get("/devices", response_model=List[DeviceResponse])
async def list_devices(
    firmware: Optional[str] = Query(default=None),
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    return repo.get_devices(firmware=firmware)


@router.get("/antennas", response_model=List[AntennaResponse])
async def list_antennas(
    band: Optional[str] = Query(default=None),
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    return repo.get_antennas(band=band)


@router.get("/cables", response_model=List[CableResponse])
async def list_cables(conn: sqlite3.Connection = Depends(get_db_connection)):
    repo = CatalogRepository(conn)
    return repo.get_cables()


@router.get("/pa-modules", response_model=List[PAModuleResponse])
async def list_pa_modules(conn: sqlite3.Connection = Depends(get_db_connection)):
    repo = CatalogRepository(conn)
    return repo.get_pa_modules()


@router.get("/power", response_model=List[PowerComponentResponse])
async def list_power_components(
    category: Optional[str] = Query(default=None),
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    return repo.get_power_components(category=category)


@router.get("/regulatory-presets", response_model=List[RegulatoryPresetResponse])
async def list_regulatory_presets(
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    return repo.get_regulatory_presets()


@router.get("/modem-presets", response_model=List[ModemPresetResponse])
async def list_modem_presets(
    firmware: Optional[str] = Query(default=None),
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    return repo.get_modem_presets(firmware=firmware)


@router.get("/firmware-defaults", response_model=List[FirmwareRegionDefaultResponse])
async def list_firmware_defaults(
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    return repo.get_firmware_region_defaults()


# ============================================================================
# Catalog Create Endpoints (specific POST paths)
# ============================================================================

@router.post("/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_device(
    device: CustomDeviceCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    device_id = repo.create_custom_device(
        name=device.name, mcu=device.mcu, radio_chip=device.radio_chip,
        max_tx_power_dbm=device.max_tx_power_dbm, frequency_bands=device.frequency_bands,
        has_gps=device.has_gps, battery_type=device.battery_type,
        battery_capacity_mah=device.battery_capacity_mah, form_factor=device.form_factor,
        has_bluetooth=device.has_bluetooth, has_wifi=device.has_wifi,
        price_usd=device.price_usd, compatible_firmware=device.compatible_firmware,
        tx_current_ma=device.tx_current_ma, rx_current_ma=device.rx_current_ma,
        sleep_current_ma=device.sleep_current_ma,
    )
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices WHERE id = ?", (device_id,))
    return dict(cursor.fetchone())


@router.post("/antennas", response_model=AntennaResponse, status_code=status.HTTP_201_CREATED)
async def create_antenna(
    antenna: AntennaCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    item_id = repo.create_antenna(
        name=antenna.name, frequency_band=antenna.frequency_band,
        gain_dbi=antenna.gain_dbi, polarization=antenna.polarization,
        form_factor=antenna.form_factor, connector_type=antenna.connector_type,
        price_usd=antenna.price_usd, is_default=antenna.is_default,
    )
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM antennas WHERE id = ?", (item_id,))
    return dict(cursor.fetchone())


@router.post("/cables", response_model=CableResponse, status_code=status.HTTP_201_CREATED)
async def create_cable(
    cable: CableCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    item_id = repo.create_cable(
        name=cable.name, cable_type=cable.cable_type,
        loss_per_m_915mhz=cable.loss_per_m_915mhz,
        loss_per_m_868mhz=cable.loss_per_m_868mhz,
        loss_per_m_433mhz=cable.loss_per_m_433mhz,
        connector_types=cable.connector_types,
        price_per_m_usd=cable.price_per_m_usd,
    )
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cables WHERE id = ?", (item_id,))
    return dict(cursor.fetchone())


@router.post("/pa-modules", response_model=PAModuleResponse, status_code=status.HTTP_201_CREATED)
async def create_pa_module(
    pa: PAModuleCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    item_id = repo.create_pa_module(
        name=pa.name, frequency_range=pa.frequency_range,
        max_output_power_dbm=pa.max_output_power_dbm,
        input_power_range=pa.input_power_range,
        current_draw_ma=pa.current_draw_ma, price_usd=pa.price_usd,
    )
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pa_modules WHERE id = ?", (item_id,))
    return dict(cursor.fetchone())


@router.post("/power", response_model=PowerComponentResponse, status_code=status.HTTP_201_CREATED)
async def create_power_component(
    comp: PowerComponentCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    item_id = repo.create_power_component(
        category=comp.category, name=comp.name,
        specs=comp.specs, price_usd=comp.price_usd,
    )
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM power_components WHERE id = ?", (item_id,))
    return dict(cursor.fetchone())


@router.post("/regulatory-presets", response_model=RegulatoryPresetResponse, status_code=status.HTTP_201_CREATED)
async def create_regulatory_preset(
    preset: RegulatoryPresetCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    item_id = repo.create_regulatory_preset(
        name=preset.name, region_code=preset.region_code,
        min_frequency_mhz=preset.min_frequency_mhz,
        max_frequency_mhz=preset.max_frequency_mhz,
        max_tx_power_dbm=preset.max_tx_power_dbm,
        max_erp_dbm=preset.max_erp_dbm,
        duty_cycle_pct=preset.duty_cycle_pct,
        bandwidths_khz=preset.bandwidths_khz,
    )
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM regulatory_presets WHERE id = ?", (item_id,))
    return dict(cursor.fetchone())


@router.post("/modem-presets", response_model=ModemPresetResponse, status_code=status.HTTP_201_CREATED)
async def create_modem_preset(
    preset: ModemPresetCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    item_id = repo.create_modem_preset(
        name=preset.name, firmware=preset.firmware,
        spreading_factor=preset.spreading_factor,
        bandwidth_khz=preset.bandwidth_khz,
        coding_rate=preset.coding_rate,
        receiver_sensitivity_dbm=preset.receiver_sensitivity_dbm,
        is_default=preset.is_default, sort_order=preset.sort_order,
    )
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM modem_presets WHERE id = ?", (item_id,))
    return dict(cursor.fetchone())


@router.post("/firmware-defaults", response_model=FirmwareRegionDefaultResponse, status_code=status.HTTP_201_CREATED)
async def create_firmware_default(
    default: FirmwareRegionDefaultCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = CatalogRepository(conn)
    item_id = repo.create_firmware_region_default(
        firmware=default.firmware, region_code=default.region_code,
        default_frequency_mhz=default.default_frequency_mhz,
        default_modem_preset_id=default.default_modem_preset_id,
    )
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM firmware_region_defaults WHERE id = ?", (item_id,))
    return dict(cursor.fetchone())


# ============================================================================
# CSV Export (specific suffix paths — must come BEFORE /{table}/{item_id})
# ============================================================================

@router.get("/{table}/export")
async def export_csv(
    table: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    db_table = _resolve_table(table)
    repo = CatalogRepository(conn)
    csv_data = repo.export_table_csv(db_table)
    return PlainTextResponse(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{db_table}.csv"'},
    )


# ============================================================================
# CSV Import & Reset (specific suffix paths — must come BEFORE /{table}/{item_id})
# ============================================================================

@router.post("/{table}/import")
async def import_csv(
    table: str,
    file: UploadFile = File(...),
    mode: str = Query(default="merge", description="merge or replace"),
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    db_table = _resolve_table(table)
    csv_data = (await file.read()).decode("utf-8")
    repo = CatalogRepository(conn)
    try:
        count = repo.import_table_csv(db_table, csv_data, mode=mode)
        return {"imported": count, "mode": mode}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{table}/reset")
async def reset_table(
    table: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    db_table = _resolve_table(table)
    repo = CatalogRepository(conn)
    try:
        repo.reset_table(db_table)
        return {"status": "reset", "table": db_table}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Generic Update / Delete (parameterized — MUST be last to avoid route conflicts)
# ============================================================================

@router.put("/{table}/{item_id}")
async def update_catalog_item(
    table: str, item_id: str, body: CatalogItemUpdate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    db_table = _resolve_table(table)
    repo = CatalogRepository(conn)
    try:
        return repo.update_item(db_table, item_id, body.fields)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{table}/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog_item(
    table: str, item_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    db_table = _resolve_table(table)
    repo = CatalogRepository(conn)
    try:
        repo.delete_item(db_table, item_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
