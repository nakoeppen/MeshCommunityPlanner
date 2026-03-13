-- Migration 005: Add per-node coverage_environment column
-- Allows individual nodes to override the plan-wide environment setting.
-- NULL means "inherit from plan global setting".
ALTER TABLE nodes ADD COLUMN coverage_environment TEXT DEFAULT NULL;
