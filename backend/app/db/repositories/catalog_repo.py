"""
Catalog Repository - CRUD operations for all hardware catalog and reference tables.

Supports filtering, creation, update, deletion, CSV import/export, and reset.
Uses parameterized queries for SQL injection prevention.
"""

import csv
import io
import json
import sqlite3
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any


# Tables that support is_custom flag (full CRUD)
CATALOG_TABLES = {"devices", "antennas", "cables", "pa_modules", "power_components"}

# Reference tables (read-only built-in, can add new)
REFERENCE_TABLES = {"regulatory_presets", "modem_presets", "firmware_region_defaults"}

ALL_TABLES = CATALOG_TABLES | REFERENCE_TABLES

# Allowed columns per table (prevents arbitrary column injection)
TABLE_COLUMNS: Dict[str, List[str]] = {
    "devices": [
        "id", "name", "mcu", "radio_chip", "max_tx_power_dbm",
        "frequency_bands", "has_gps", "battery_type", "battery_capacity_mah",
        "form_factor", "has_bluetooth", "has_wifi", "price_usd",
        "compatible_firmware", "tx_current_ma", "rx_current_ma",
        "sleep_current_ma", "is_custom",
    ],
    "antennas": [
        "id", "name", "frequency_band", "gain_dbi", "polarization",
        "form_factor", "connector_type", "price_usd", "is_default", "is_custom",
    ],
    "cables": [
        "id", "name", "cable_type", "loss_per_m_915mhz", "loss_per_m_868mhz",
        "loss_per_m_433mhz", "connector_types", "price_per_m_usd", "is_custom",
    ],
    "pa_modules": [
        "id", "name", "frequency_range", "max_output_power_dbm",
        "input_power_range", "current_draw_ma", "price_usd", "is_custom",
    ],
    "power_components": [
        "id", "category", "name", "specs", "price_usd", "is_custom",
    ],
    "regulatory_presets": [
        "id", "name", "region_code", "min_frequency_mhz", "max_frequency_mhz",
        "max_tx_power_dbm", "max_erp_dbm", "duty_cycle_pct", "bandwidths_khz",
    ],
    "modem_presets": [
        "id", "name", "firmware", "spreading_factor", "bandwidth_khz",
        "coding_rate", "receiver_sensitivity_dbm", "is_default", "sort_order",
    ],
    "firmware_region_defaults": [
        "id", "firmware", "region_code", "default_frequency_mhz",
        "default_modem_preset_id",
    ],
}


def _validate_table(table: str) -> None:
    if table not in ALL_TABLES:
        raise ValueError(f"Invalid table: {table}")


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (list, dict)):
        return json.dumps(value)
    return value


class CatalogRepository:
    """Repository for hardware catalog CRUD operations."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    # ========================================================================
    # READ operations
    # ========================================================================

    def get_devices(self, firmware: Optional[str] = None) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        if firmware:
            cursor.execute("""
                SELECT * FROM devices
                WHERE compatible_firmware LIKE ?
                ORDER BY is_custom ASC, name ASC
            """, (f'%"{firmware}"%',))
        else:
            cursor.execute("SELECT * FROM devices ORDER BY is_custom ASC, name ASC")
        return [dict(row) for row in cursor.fetchall()]

    def get_antennas(self, band: Optional[str] = None) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        if band:
            cursor.execute("""
                SELECT * FROM antennas WHERE frequency_band = ?
                ORDER BY is_custom ASC, is_default DESC, gain_dbi ASC
            """, (band,))
        else:
            cursor.execute("""
                SELECT * FROM antennas
                ORDER BY is_custom ASC, frequency_band ASC, is_default DESC, gain_dbi ASC
            """)
        return [dict(row) for row in cursor.fetchall()]

    def get_cables(self) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM cables ORDER BY is_custom ASC, cable_type ASC")
        return [dict(row) for row in cursor.fetchall()]

    def get_pa_modules(self) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM pa_modules ORDER BY is_custom ASC, max_output_power_dbm DESC")
        return [dict(row) for row in cursor.fetchall()]

    def get_power_components(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        if category:
            cursor.execute("""
                SELECT * FROM power_components WHERE category = ?
                ORDER BY is_custom ASC, name ASC
            """, (category,))
        else:
            cursor.execute("SELECT * FROM power_components ORDER BY is_custom ASC, category ASC, name ASC")
        return [dict(row) for row in cursor.fetchall()]

    def get_regulatory_presets(self) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM regulatory_presets ORDER BY name ASC")
        return [dict(row) for row in cursor.fetchall()]

    def get_modem_presets(self, firmware: Optional[str] = None) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        if firmware:
            cursor.execute("""
                SELECT * FROM modem_presets WHERE firmware = ?
                ORDER BY sort_order ASC, name ASC
            """, (firmware,))
        else:
            cursor.execute("SELECT * FROM modem_presets ORDER BY firmware ASC, sort_order ASC, name ASC")
        return [dict(row) for row in cursor.fetchall()]

    def get_firmware_region_defaults(self) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM firmware_region_defaults ORDER BY firmware ASC, region_code ASC")
        return [dict(row) for row in cursor.fetchall()]

    def get_all_items(self, table: str) -> List[Dict[str, Any]]:
        _validate_table(table)
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT * FROM {table}")  # noqa: S608
        return [dict(row) for row in cursor.fetchall()]

    # ========================================================================
    # CREATE operations
    # ========================================================================

    def create_custom_device(
        self, name: str, mcu: str, radio_chip: str, max_tx_power_dbm: float,
        frequency_bands: str, has_gps: bool, compatible_firmware: str,
        battery_type: Optional[str] = None, battery_capacity_mah: Optional[int] = None,
        form_factor: Optional[str] = None, has_bluetooth: bool = False,
        has_wifi: bool = False, price_usd: Optional[float] = None,
        tx_current_ma: Optional[float] = None, rx_current_ma: Optional[float] = None,
        sleep_current_ma: Optional[float] = None,
    ) -> str:
        device_id = str(uuid.uuid4())
        self.conn.execute("""
            INSERT INTO devices (
                id, name, mcu, radio_chip, max_tx_power_dbm, frequency_bands,
                has_gps, battery_type, battery_capacity_mah, form_factor,
                has_bluetooth, has_wifi, price_usd, compatible_firmware,
                tx_current_ma, rx_current_ma, sleep_current_ma, is_custom
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (
            device_id, name, mcu, radio_chip, max_tx_power_dbm, frequency_bands,
            1 if has_gps else 0, battery_type, battery_capacity_mah, form_factor,
            1 if has_bluetooth else 0, 1 if has_wifi else 0, price_usd,
            compatible_firmware, tx_current_ma, rx_current_ma, sleep_current_ma,
        ))
        self.conn.commit()
        return device_id

    def create_antenna(
        self, name: str, frequency_band: str, gain_dbi: float,
        polarization: Optional[str] = None, form_factor: Optional[str] = None,
        connector_type: Optional[str] = None, price_usd: Optional[float] = None,
        is_default: bool = False,
    ) -> str:
        item_id = str(uuid.uuid4())
        self.conn.execute("""
            INSERT INTO antennas (id, name, frequency_band, gain_dbi, polarization,
                form_factor, connector_type, price_usd, is_default, is_custom)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (item_id, name, frequency_band, gain_dbi, polarization,
              form_factor, connector_type, price_usd, 1 if is_default else 0))
        self.conn.commit()
        return item_id

    def create_cable(
        self, name: str, cable_type: str, loss_per_m_915mhz: float,
        loss_per_m_868mhz: float, loss_per_m_433mhz: Optional[float] = None,
        connector_types: Optional[str] = None, price_per_m_usd: Optional[float] = None,
    ) -> str:
        item_id = str(uuid.uuid4())
        self.conn.execute("""
            INSERT INTO cables (id, name, cable_type, loss_per_m_915mhz, loss_per_m_868mhz,
                loss_per_m_433mhz, connector_types, price_per_m_usd, is_custom)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (item_id, name, cable_type, loss_per_m_915mhz, loss_per_m_868mhz,
              loss_per_m_433mhz, connector_types, price_per_m_usd))
        self.conn.commit()
        return item_id

    def create_pa_module(
        self, name: str, frequency_range: str, max_output_power_dbm: float,
        current_draw_ma: float, input_power_range: Optional[str] = None,
        price_usd: Optional[float] = None,
    ) -> str:
        item_id = str(uuid.uuid4())
        self.conn.execute("""
            INSERT INTO pa_modules (id, name, frequency_range, max_output_power_dbm,
                input_power_range, current_draw_ma, price_usd, is_custom)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """, (item_id, name, frequency_range, max_output_power_dbm,
              input_power_range, current_draw_ma, price_usd))
        self.conn.commit()
        return item_id

    def create_power_component(
        self, category: str, name: str, specs: str,
        price_usd: Optional[float] = None,
    ) -> str:
        item_id = str(uuid.uuid4())
        self.conn.execute("""
            INSERT INTO power_components (id, category, name, specs, price_usd, is_custom)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (item_id, category, name, specs, price_usd))
        self.conn.commit()
        return item_id

    def create_regulatory_preset(
        self, name: str, region_code: str, min_frequency_mhz: float,
        max_frequency_mhz: float, max_tx_power_dbm: float,
        duty_cycle_pct: float, bandwidths_khz: str,
        max_erp_dbm: Optional[float] = None,
    ) -> str:
        item_id = str(uuid.uuid4())
        self.conn.execute("""
            INSERT INTO regulatory_presets (id, name, region_code, min_frequency_mhz,
                max_frequency_mhz, max_tx_power_dbm, max_erp_dbm, duty_cycle_pct, bandwidths_khz)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (item_id, name, region_code, min_frequency_mhz, max_frequency_mhz,
              max_tx_power_dbm, max_erp_dbm, duty_cycle_pct, bandwidths_khz))
        self.conn.commit()
        return item_id

    def create_modem_preset(
        self, name: str, firmware: str, spreading_factor: int,
        bandwidth_khz: float, coding_rate: str, receiver_sensitivity_dbm: float,
        is_default: bool = False, sort_order: int = 0,
    ) -> str:
        item_id = str(uuid.uuid4())
        self.conn.execute("""
            INSERT INTO modem_presets (id, name, firmware, spreading_factor,
                bandwidth_khz, coding_rate, receiver_sensitivity_dbm, is_default, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (item_id, name, firmware, spreading_factor, bandwidth_khz,
              coding_rate, receiver_sensitivity_dbm, 1 if is_default else 0, sort_order))
        self.conn.commit()
        return item_id

    def create_firmware_region_default(
        self, firmware: str, region_code: str, default_frequency_mhz: float,
        default_modem_preset_id: Optional[str] = None,
    ) -> str:
        item_id = str(uuid.uuid4())
        self.conn.execute("""
            INSERT INTO firmware_region_defaults (id, firmware, region_code,
                default_frequency_mhz, default_modem_preset_id)
            VALUES (?, ?, ?, ?, ?)
        """, (item_id, firmware, region_code, default_frequency_mhz, default_modem_preset_id))
        self.conn.commit()
        return item_id

    # ========================================================================
    # UPDATE operations
    # ========================================================================

    def update_item(self, table: str, item_id: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        _validate_table(table)

        # Block edits to built-in items
        if table in CATALOG_TABLES:
            cursor = self.conn.cursor()
            cursor.execute(f"SELECT is_custom FROM {table} WHERE id = ?", (item_id,))  # noqa: S608
            row = cursor.fetchone()
            if row is None:
                raise ValueError(f"Item {item_id} not found in {table}")
            if not row["is_custom"]:
                raise ValueError("Cannot edit built-in catalog items. Create a custom copy instead.")

        allowed = set(TABLE_COLUMNS[table]) - {"id"}
        # Filter to only allowed columns
        safe_fields = {k: _serialize_value(v) for k, v in fields.items() if k in allowed}
        if not safe_fields:
            raise ValueError("No valid fields to update")

        set_clause = ", ".join(f"{col} = ?" for col in safe_fields)
        values = list(safe_fields.values()) + [item_id]
        self.conn.execute(
            f"UPDATE {table} SET {set_clause} WHERE id = ?",  # noqa: S608
            values,
        )
        self.conn.commit()

        # Return updated row
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT * FROM {table} WHERE id = ?", (item_id,))  # noqa: S608
        row = cursor.fetchone()
        if row is None:
            raise ValueError(f"Item {item_id} not found in {table}")
        return dict(row)

    # ========================================================================
    # DELETE operations
    # ========================================================================

    def delete_item(self, table: str, item_id: str) -> None:
        _validate_table(table)
        if table in CATALOG_TABLES:
            # Only allow deleting custom items
            cursor = self.conn.cursor()
            cursor.execute(f"SELECT is_custom FROM {table} WHERE id = ?", (item_id,))  # noqa: S608
            row = cursor.fetchone()
            if row is None:
                raise ValueError(f"Item {item_id} not found in {table}")
            if not row["is_custom"]:
                raise ValueError("Cannot delete built-in catalog items")
        self.conn.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))  # noqa: S608
        self.conn.commit()

    # ========================================================================
    # CSV Export / Import
    # ========================================================================

    def export_table_csv(self, table: str) -> str:
        _validate_table(table)
        columns = TABLE_COLUMNS[table]
        rows = self.get_all_items(table)

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({col: row.get(col, "") for col in columns})
        return output.getvalue()

    def import_table_csv(self, table: str, csv_data: str, mode: str = "merge") -> int:
        """Import CSV data into a catalog table.

        Validates CSV structure before any writes. Built-in items (is_custom=0)
        are never overwritten — rows whose ID matches a built-in entry are
        silently skipped to protect seed data.
        """
        _validate_table(table)
        columns = TABLE_COLUMNS[table]

        # --- Phase 1: Validate CSV structure ---
        try:
            reader = csv.DictReader(io.StringIO(csv_data))
            csv_columns = reader.fieldnames
        except csv.Error as e:
            raise ValueError(f"CSV parsing error: {e}")

        if not csv_columns:
            raise ValueError(
                "CSV file is empty or has no header row. "
                "Export the table first to see the expected format."
            )

        # Check for required columns (at least 'name' or a key identifying column)
        allowed_set = set(columns)
        csv_col_set = set(csv_columns)
        unknown_cols = csv_col_set - allowed_set
        if unknown_cols:
            raise ValueError(
                f"CSV contains unknown column(s): {', '.join(sorted(unknown_cols))}. "
                f"Allowed columns for {table}: {', '.join(columns)}"
            )

        # Must have at least one data column besides 'id' and 'is_custom'
        data_cols = csv_col_set - {"id", "is_custom"}
        if not data_cols:
            raise ValueError(
                "CSV must contain at least one data column (not just 'id' or 'is_custom'). "
                f"Allowed columns: {', '.join(columns)}"
            )

        # --- Phase 2: Collect built-in IDs to protect them ---
        builtin_ids: set = set()
        if table in CATALOG_TABLES:
            cursor = self.conn.cursor()
            cursor.execute(
                f"SELECT id FROM {table} WHERE is_custom = 0",  # noqa: S608
            )
            builtin_ids = {row["id"] for row in cursor.fetchall()}

        # --- Phase 3: Parse all rows and validate before writing ---
        parsed_rows: list[dict] = []
        # Re-read the CSV (reader is consumed)
        reader = csv.DictReader(io.StringIO(csv_data))
        row_errors: list[str] = []

        for row_num, row in enumerate(reader, start=2):  # row 1 is header
            values: dict = {}
            for col in columns:
                if col in row and row[col] != "":
                    values[col] = row[col]

            if not values or all(k in ("id", "is_custom") for k in values):
                row_errors.append(f"Row {row_num}: no data columns present")
                continue

            # Skip rows that match a built-in item ID
            row_id = values.get("id", "")
            if row_id and row_id in builtin_ids:
                continue  # silently skip — don't overwrite built-in

            if not row_id:
                values["id"] = str(uuid.uuid4())

            # Force is_custom=1 for catalog tables
            if table in CATALOG_TABLES:
                values["is_custom"] = 1

            parsed_rows.append(values)

        if row_errors and not parsed_rows:
            raise ValueError(
                f"CSV validation failed — no valid rows found. "
                f"Issues: {'; '.join(row_errors[:5])}"
            )

        # --- Phase 4: Write validated rows ---
        if mode == "replace" and table in CATALOG_TABLES:
            # Delete custom items only (built-in preserved)
            self.conn.execute(f"DELETE FROM {table} WHERE is_custom = 1")  # noqa: S608

        imported = 0
        for values in parsed_rows:
            placeholders = ", ".join("?" for _ in values)
            col_names = ", ".join(values.keys())
            val_list = list(values.values())

            try:
                self.conn.execute(
                    f"INSERT OR IGNORE INTO {table} ({col_names}) VALUES ({placeholders})",  # noqa: S608
                    val_list,
                )
                imported += 1
            except sqlite3.IntegrityError:
                continue

        self.conn.commit()
        return imported

    # ========================================================================
    # Reset to defaults
    # ========================================================================

    def reset_table(self, table: str) -> None:
        _validate_table(table)
        if table not in CATALOG_TABLES:
            raise ValueError("Can only reset catalog tables with is_custom flag")

        # Delete custom items
        self.conn.execute(f"DELETE FROM {table} WHERE is_custom = 1")  # noqa: S608
        self.conn.commit()

        # Re-seed from JSON
        seed_dir = Path(__file__).parent.parent / "seed"
        json_filename = f"{table}.json"
        json_path = seed_dir / json_filename

        if not json_path.exists():
            return

        data = json.loads(json_path.read_text(encoding="utf-8"))
        columns = TABLE_COLUMNS[table]
        placeholders = ", ".join("?" for _ in columns)
        col_names = ", ".join(columns)

        for entry in data:
            row_values = tuple(_serialize_value(entry.get(col)) for col in columns)
            try:
                self.conn.execute(
                    f"INSERT OR IGNORE INTO {table} ({col_names}) VALUES ({placeholders})",  # noqa: S608
                    row_values,
                )
            except sqlite3.IntegrityError:
                continue

        self.conn.commit()
