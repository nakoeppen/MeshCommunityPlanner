-- Initial schema: all tables from design doc
-- Version 1

-- Plans
CREATE TABLE plans (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    firmware_family TEXT,
    region          TEXT,
    file_path       TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- Devices (catalog, seeded from JSON)
CREATE TABLE devices (
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
);

-- Antennas (catalog, seeded from JSON)
CREATE TABLE antennas (
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
);

-- Cables (catalog, seeded from JSON)
CREATE TABLE cables (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    cable_type          TEXT NOT NULL,
    loss_per_m_915mhz   REAL NOT NULL,
    loss_per_m_868mhz   REAL NOT NULL,
    loss_per_m_433mhz   REAL,
    connector_types     TEXT,
    price_per_m_usd     REAL,
    is_custom           INTEGER DEFAULT 0
);

-- PA modules (catalog, seeded from JSON)
CREATE TABLE pa_modules (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    frequency_range     TEXT NOT NULL,
    max_output_power_dbm REAL NOT NULL,
    input_power_range   TEXT,
    current_draw_ma     REAL NOT NULL,
    price_usd           REAL,
    is_custom           INTEGER DEFAULT 0
);

-- Power components (catalog, seeded from JSON)
CREATE TABLE power_components (
    id          TEXT PRIMARY KEY,
    category    TEXT NOT NULL,
    name        TEXT NOT NULL,
    specs       TEXT NOT NULL,
    price_usd   REAL,
    is_custom   INTEGER DEFAULT 0
);

-- Regulatory presets (catalog, seeded from JSON)
CREATE TABLE regulatory_presets (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    region_code       TEXT NOT NULL UNIQUE,
    min_frequency_mhz REAL NOT NULL,
    max_frequency_mhz REAL NOT NULL,
    max_tx_power_dbm  REAL NOT NULL,
    max_erp_dbm       REAL,
    duty_cycle_pct    REAL NOT NULL,
    bandwidths_khz    TEXT NOT NULL
);

-- Modem presets (catalog, seeded from JSON)
CREATE TABLE modem_presets (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    firmware              TEXT NOT NULL,
    spreading_factor      INTEGER NOT NULL,
    bandwidth_khz         REAL NOT NULL,
    coding_rate           TEXT NOT NULL,
    receiver_sensitivity_dbm REAL NOT NULL,
    is_default            INTEGER DEFAULT 0,
    sort_order            INTEGER DEFAULT 0
);

-- Firmware region defaults (catalog, seeded from JSON)
CREATE TABLE firmware_region_defaults (
    id              TEXT PRIMARY KEY,
    firmware        TEXT NOT NULL,
    region_code     TEXT NOT NULL,
    default_frequency_mhz REAL NOT NULL,
    default_modem_preset_id TEXT REFERENCES modem_presets(id),
    UNIQUE(firmware, region_code)
);

-- Nodes within a plan (depends on plans + catalog tables)
CREATE TABLE nodes (
    id                TEXT PRIMARY KEY,
    plan_id           TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    latitude          REAL NOT NULL,
    longitude         REAL NOT NULL,
    antenna_height_m  REAL NOT NULL DEFAULT 2.0,
    device_id         TEXT NOT NULL REFERENCES devices(id),
    firmware          TEXT NOT NULL,
    region            TEXT NOT NULL,
    frequency_mhz     REAL NOT NULL,
    tx_power_dbm      REAL NOT NULL,
    spreading_factor  INTEGER NOT NULL,
    bandwidth_khz     REAL NOT NULL,
    coding_rate       TEXT NOT NULL,
    modem_preset      TEXT,
    antenna_id        TEXT NOT NULL REFERENCES antennas(id),
    cable_id          TEXT REFERENCES cables(id),
    cable_length_m    REAL DEFAULT 0.0,
    pa_module_id      TEXT REFERENCES pa_modules(id),
    is_solar          INTEGER DEFAULT 0,
    desired_coverage_radius_m REAL,
    notes             TEXT DEFAULT '',
    sort_order        INTEGER DEFAULT 0,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);
CREATE INDEX idx_nodes_plan ON nodes(plan_id);

-- Templates
CREATE TABLE templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    firmware    TEXT NOT NULL,
    region      TEXT NOT NULL,
    config      TEXT NOT NULL,
    is_builtin  INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Propagation cache
CREATE TABLE propagation_cache (
    id          TEXT PRIMARY KEY,
    plan_id     TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    node_id     TEXT REFERENCES nodes(id) ON DELETE CASCADE,
    engine      TEXT NOT NULL,
    params_hash TEXT NOT NULL,
    result_data BLOB NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX idx_prop_cache_plan ON propagation_cache(plan_id);

-- Activity log
CREATE TABLE activity_log (
    id          TEXT PRIMARY KEY,
    timestamp   TEXT NOT NULL,
    destination TEXT NOT NULL,
    action      TEXT NOT NULL,
    data_summary TEXT NOT NULL,
    response_status INTEGER,
    response_summary TEXT,
    plan_id     TEXT REFERENCES plans(id) ON DELETE SET NULL
);
CREATE INDEX idx_activity_log_time ON activity_log(timestamp);

-- Settings (key-value store)
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
