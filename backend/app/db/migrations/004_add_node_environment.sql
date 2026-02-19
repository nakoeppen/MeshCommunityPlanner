-- Migration 004: Add per-node environment column
-- Each node can have its own propagation environment setting
-- Default 'suburban' matches existing network-wide behavior
ALTER TABLE nodes ADD COLUMN environment TEXT NOT NULL DEFAULT 'suburban';
