-- Audit trail table for tracking data mutations
-- Version 2

CREATE TABLE IF NOT EXISTS audit_trail (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    action          TEXT NOT NULL,
    before_data     TEXT,
    after_data      TEXT,
    source          TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_trail(timestamp);
