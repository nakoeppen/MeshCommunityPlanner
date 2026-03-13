"""Unit tests for seed data loader (backend/app/db/seed/loader.py).

Tests cover:
- First run: seed data inserted correctly
- Second run (INSERT OR REPLACE): updated fields propagate
- Duplicate primary key: INSERT OR REPLACE, not duplicate rows
- Missing seed file: skipped gracefully
- Seed file with empty array: handled without error
- load_settings_defaults: inserts defaults on empty settings table
- load_settings_defaults: skips if settings already populated

All tests use an in-memory SQLite DB (:memory:) with the minimal schema
required by the loader.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from unittest.mock import patch

import pytest

from backend.app.db.seed.loader import (
    SEED_FILES,
    SETTINGS_DEFAULTS,
    _serialize_value,
    load_seed_data,
    load_settings_defaults,
)


# ============================================================================
# Minimal schema helpers
# ============================================================================

# Only the tables exercised by our test seeds are created here.
# We don't need all catalog tables for unit tests.
_CREATE_DEVICES = """
CREATE TABLE IF NOT EXISTS devices (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    mcu                 TEXT NOT NULL,
    radio_chip          TEXT NOT NULL,
    max_tx_power_dbm    REAL NOT NULL,
    frequency_bands     TEXT NOT NULL,
    has_gps             INTEGER NOT NULL,
    battery_type        TEXT,
    battery_capacity_mah INTEGER,
    form_factor         TEXT,
    has_bluetooth       INTEGER DEFAULT 0,
    has_wifi            INTEGER DEFAULT 0,
    price_usd           REAL,
    compatible_firmware TEXT NOT NULL,
    tx_current_ma       REAL,
    rx_current_ma       REAL,
    sleep_current_ma    REAL,
    is_custom           INTEGER DEFAULT 0
)
"""

_CREATE_ANTENNAS = """
CREATE TABLE IF NOT EXISTS antennas (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    frequency_band  TEXT NOT NULL,
    gain_dbi        REAL NOT NULL,
    polarization    TEXT,
    form_factor     TEXT,
    connector_type  TEXT,
    price_usd       REAL,
    is_default      INTEGER DEFAULT 0,
    is_custom       INTEGER DEFAULT 0
)
"""

_CREATE_CABLES = """
CREATE TABLE IF NOT EXISTS cables (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    cable_type          TEXT NOT NULL,
    loss_per_m_915mhz   REAL NOT NULL,
    loss_per_m_868mhz   REAL NOT NULL,
    loss_per_m_433mhz   REAL,
    connector_types     TEXT,
    price_per_m_usd     REAL,
    is_custom           INTEGER DEFAULT 0
)
"""

_CREATE_PA_MODULES = """
CREATE TABLE IF NOT EXISTS pa_modules (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    frequency_range     TEXT NOT NULL,
    max_output_power_dbm REAL NOT NULL,
    input_power_range   TEXT,
    current_draw_ma     REAL NOT NULL,
    price_usd           REAL,
    is_custom           INTEGER DEFAULT 0
)
"""

_CREATE_POWER_COMPONENTS = """
CREATE TABLE IF NOT EXISTS power_components (
    id          TEXT PRIMARY KEY,
    category    TEXT NOT NULL,
    name        TEXT NOT NULL,
    specs       TEXT NOT NULL,
    price_usd   REAL,
    is_custom   INTEGER DEFAULT 0
)
"""

_CREATE_REGULATORY_PRESETS = """
CREATE TABLE IF NOT EXISTS regulatory_presets (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    region_code       TEXT NOT NULL UNIQUE,
    min_frequency_mhz REAL NOT NULL,
    max_frequency_mhz REAL NOT NULL,
    max_tx_power_dbm  REAL NOT NULL,
    max_erp_dbm       REAL,
    duty_cycle_pct    REAL NOT NULL,
    bandwidths_khz    TEXT NOT NULL
)
"""

_CREATE_MODEM_PRESETS = """
CREATE TABLE IF NOT EXISTS modem_presets (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    firmware              TEXT NOT NULL,
    spreading_factor      INTEGER NOT NULL,
    bandwidth_khz         REAL NOT NULL,
    coding_rate           TEXT NOT NULL,
    receiver_sensitivity_dbm REAL NOT NULL,
    is_default            INTEGER DEFAULT 0,
    sort_order            INTEGER DEFAULT 0
)
"""

_CREATE_FIRMWARE_REGION_DEFAULTS = """
CREATE TABLE IF NOT EXISTS firmware_region_defaults (
    id              TEXT PRIMARY KEY,
    firmware        TEXT NOT NULL,
    region_code     TEXT NOT NULL,
    default_frequency_mhz REAL NOT NULL,
    default_modem_preset_id TEXT,
    UNIQUE(firmware, region_code)
)
"""

_CREATE_SETTINGS = """
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
)
"""

_ALL_CREATES = [
    _CREATE_DEVICES,
    _CREATE_ANTENNAS,
    _CREATE_CABLES,
    _CREATE_PA_MODULES,
    _CREATE_POWER_COMPONENTS,
    _CREATE_REGULATORY_PRESETS,
    _CREATE_MODEM_PRESETS,
    _CREATE_FIRMWARE_REGION_DEFAULTS,
    _CREATE_SETTINGS,
]


def _make_conn() -> sqlite3.Connection:
    """Create an in-memory SQLite connection with the full catalog schema."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    for stmt in _ALL_CREATES:
        conn.execute(stmt)
    conn.commit()
    return conn


# ============================================================================
# Helpers: minimal seed data dicts
# ============================================================================

_DEVICE_COLUMNS = SEED_FILES["devices.json"][1]
_ANTENNA_COLUMNS = SEED_FILES["antennas.json"][1]


def _minimal_device(id_: str = "dev-001", name: str = "TestDevice") -> dict:
    return {
        "id": id_,
        "name": name,
        "mcu": "nRF52840",
        "radio_chip": "SX1262",
        "max_tx_power_dbm": 22.0,
        "frequency_bands": ["915"],
        "has_gps": 0,
        "battery_type": None,
        "battery_capacity_mah": None,
        "form_factor": "breakout",
        "has_bluetooth": 1,
        "has_wifi": 0,
        "price_usd": 30.0,
        "compatible_firmware": ["meshtastic"],
        "tx_current_ma": 80.0,
        "rx_current_ma": 5.5,
        "sleep_current_ma": 0.02,
        "is_custom": 0,
    }


def _minimal_antenna(id_: str = "ant-001", name: str = "TestAntenna") -> dict:
    return {
        "id": id_,
        "name": name,
        "frequency_band": "915",
        "gain_dbi": 3.0,
        "polarization": "vertical",
        "form_factor": "omni",
        "connector_type": "SMA",
        "price_usd": 10.0,
        "is_default": 1,
        "is_custom": 0,
    }


# ============================================================================
# _serialize_value
# ============================================================================


class TestSerializeValue:
    def test_list_serialized_to_json_string(self):
        assert _serialize_value(["a", "b"]) == '["a", "b"]'

    def test_dict_serialized_to_json_string(self):
        result = _serialize_value({"k": "v"})
        assert json.loads(result) == {"k": "v"}

    def test_scalar_returned_unchanged(self):
        assert _serialize_value(42) == 42
        assert _serialize_value("hello") == "hello"
        assert _serialize_value(None) is None
        assert _serialize_value(3.14) == 3.14


# ============================================================================
# load_seed_data — first run inserts data
# ============================================================================


class TestLoadSeedDataFirstRun:
    def test_seed_file_inserts_rows(self, tmp_path):
        """First run with a devices.json seed file inserts the device row."""
        conn = _make_conn()
        seed_data = [_minimal_device()]

        seed_json = tmp_path / "devices.json"
        seed_json.write_text(json.dumps(seed_data), encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            # Only patch devices.json in SEED_FILES for this test
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)

        rows = conn.execute("SELECT * FROM devices WHERE id = 'dev-001'").fetchall()
        assert len(rows) == 1
        assert rows[0]["name"] == "TestDevice"

    def test_list_fields_serialized_to_json_strings(self, tmp_path):
        """Fields that are lists (frequency_bands) are stored as JSON strings."""
        conn = _make_conn()
        seed_data = [_minimal_device()]

        seed_json = tmp_path / "devices.json"
        seed_json.write_text(json.dumps(seed_data), encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)

        row = conn.execute("SELECT frequency_bands FROM devices WHERE id = 'dev-001'").fetchone()
        # Should be a JSON string, not a Python list
        stored = row[0]
        assert isinstance(stored, str)
        assert json.loads(stored) == ["915"]

    def test_multiple_rows_inserted(self, tmp_path):
        """Multiple entries in seed file are all inserted."""
        conn = _make_conn()
        seed_data = [
            _minimal_device("dev-001", "Device One"),
            _minimal_device("dev-002", "Device Two"),
            _minimal_device("dev-003", "Device Three"),
        ]

        seed_json = tmp_path / "devices.json"
        seed_json.write_text(json.dumps(seed_data), encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)

        count = conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0]
        assert count == 3

    def test_antenna_seed_inserted(self, tmp_path):
        """Antenna seed data is inserted correctly."""
        conn = _make_conn()
        seed_data = [_minimal_antenna()]

        seed_json = tmp_path / "antennas.json"
        seed_json.write_text(json.dumps(seed_data), encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"antennas.json": SEED_FILES["antennas.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)

        rows = conn.execute("SELECT * FROM antennas WHERE id = 'ant-001'").fetchall()
        assert len(rows) == 1
        assert rows[0]["gain_dbi"] == pytest.approx(3.0)


# ============================================================================
# load_seed_data — second run (INSERT OR REPLACE)
# ============================================================================


class TestLoadSeedDataUpsert:
    def test_updated_field_propagates_on_second_run(self, tmp_path):
        """INSERT OR REPLACE: running loader twice with changed data updates the row."""
        conn = _make_conn()

        # First run: price = 30.0
        seed_v1 = [_minimal_device()]
        seed_json = tmp_path / "devices.json"
        seed_json.write_text(json.dumps(seed_v1), encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)

        # Second run: price = 45.0
        device_v2 = _minimal_device()
        device_v2["price_usd"] = 45.0
        seed_json.write_text(json.dumps([device_v2]), encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)

        row = conn.execute("SELECT price_usd FROM devices WHERE id = 'dev-001'").fetchone()
        assert row["price_usd"] == pytest.approx(45.0)

    def test_no_duplicate_rows_after_second_run(self, tmp_path):
        """INSERT OR REPLACE does not create duplicate rows with same PK."""
        conn = _make_conn()
        seed_data = [_minimal_device()]
        seed_json = tmp_path / "devices.json"
        seed_json.write_text(json.dumps(seed_data), encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)
                load_seed_data(conn)  # second call, same data

        count = conn.execute("SELECT COUNT(*) FROM devices WHERE id = 'dev-001'").fetchone()[0]
        assert count == 1

    def test_name_update_propagates(self, tmp_path):
        """Updated name field is reflected after second load_seed_data call."""
        conn = _make_conn()

        seed_v1 = [_minimal_device("dev-001", "Original Name")]
        seed_json = tmp_path / "devices.json"
        seed_json.write_text(json.dumps(seed_v1), encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)

        seed_v2 = [_minimal_device("dev-001", "Updated Name")]
        seed_json.write_text(json.dumps(seed_v2), encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)

        row = conn.execute("SELECT name FROM devices WHERE id = 'dev-001'").fetchone()
        assert row["name"] == "Updated Name"


# ============================================================================
# load_seed_data — missing file / empty array
# ============================================================================


class TestLoadSeedDataEdgeCases:
    def test_missing_seed_file_skipped_gracefully(self, tmp_path):
        """Missing JSON file is skipped — no exception raised, no rows inserted."""
        conn = _make_conn()

        # tmp_path is empty — no devices.json
        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)  # must not raise

        count = conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0]
        assert count == 0

    def test_empty_array_seed_file_handled_without_error(self, tmp_path):
        """Seed file containing [] is handled without error — table stays empty."""
        conn = _make_conn()

        seed_json = tmp_path / "devices.json"
        seed_json.write_text("[]", encoding="utf-8")

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {"devices.json": SEED_FILES["devices.json"]}
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)  # must not raise

        count = conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0]
        assert count == 0

    def test_multiple_seed_files_loaded_in_one_call(self, tmp_path):
        """Both devices.json and antennas.json are loaded in a single call."""
        conn = _make_conn()

        (tmp_path / "devices.json").write_text(
            json.dumps([_minimal_device()]), encoding="utf-8"
        )
        (tmp_path / "antennas.json").write_text(
            json.dumps([_minimal_antenna()]), encoding="utf-8"
        )

        with patch("backend.app.db.seed.loader.SEED_DIR", tmp_path):
            patched_files = {
                "devices.json": SEED_FILES["devices.json"],
                "antennas.json": SEED_FILES["antennas.json"],
            }
            with patch("backend.app.db.seed.loader.SEED_FILES", patched_files):
                load_seed_data(conn)

        device_count = conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0]
        antenna_count = conn.execute("SELECT COUNT(*) FROM antennas").fetchone()[0]
        assert device_count == 1
        assert antenna_count == 1


# ============================================================================
# load_settings_defaults
# ============================================================================


class TestLoadSettingsDefaults:
    def test_default_settings_inserted_on_empty_table(self):
        """All SETTINGS_DEFAULTS keys are inserted on first call."""
        conn = _make_conn()
        load_settings_defaults(conn)

        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        stored = {row["key"]: row["value"] for row in rows}

        for key, value in SETTINGS_DEFAULTS.items():
            assert key in stored
            assert stored[key] == value

    def test_existing_settings_not_overwritten(self):
        """If settings table already has data, load_settings_defaults is a no-op."""
        conn = _make_conn()

        # Pre-populate with a custom value
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            ("unit_system", "imperial"),
        )
        conn.commit()

        load_settings_defaults(conn)

        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'unit_system'"
        ).fetchone()
        # Must remain 'imperial' — not overwritten with 'metric'
        assert row["value"] == "imperial"

    def test_settings_count_matches_defaults(self):
        """Number of settings rows equals SETTINGS_DEFAULTS count."""
        conn = _make_conn()
        load_settings_defaults(conn)

        count = conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0]
        assert count == len(SETTINGS_DEFAULTS)

    def test_second_call_is_idempotent(self):
        """Calling load_settings_defaults twice does not duplicate rows."""
        conn = _make_conn()
        load_settings_defaults(conn)
        load_settings_defaults(conn)

        count = conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0]
        assert count == len(SETTINGS_DEFAULTS)
