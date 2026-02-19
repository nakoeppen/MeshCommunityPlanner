-- Performance optimization indexes
-- Version 3

-- Composite index for propagation cache lookups by plan + hash
CREATE INDEX IF NOT EXISTS idx_prop_cache_plan_hash ON propagation_cache(plan_id, params_hash);

-- Node foreign key indexes for JOIN performance
CREATE INDEX IF NOT EXISTS idx_nodes_device ON nodes(device_id);
CREATE INDEX IF NOT EXISTS idx_nodes_antenna ON nodes(antenna_id);
CREATE INDEX IF NOT EXISTS idx_nodes_cable ON nodes(cable_id);

-- Node filtering by firmware/region (common query pattern)
CREATE INDEX IF NOT EXISTS idx_nodes_firmware_region ON nodes(firmware, region);

-- Composite audit trail index for entity + time range queries
CREATE INDEX IF NOT EXISTS idx_audit_entity_time ON audit_trail(entity_type, entity_id, timestamp);

-- Activity log plan association for cascade queries
CREATE INDEX IF NOT EXISTS idx_activity_log_plan ON activity_log(plan_id);

-- Modem preset firmware lookup
CREATE INDEX IF NOT EXISTS idx_modem_presets_firmware ON modem_presets(firmware);

-- Templates firmware/region filter
CREATE INDEX IF NOT EXISTS idx_templates_firmware_region ON templates(firmware, region);

-- Run ANALYZE to populate sqlite_stat1 for query planner
ANALYZE;
