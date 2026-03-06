-- Migration: Feed sources improvements
-- Adds total_item_count for cumulative tracking (item_count is overwritten each fetch)

ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS total_item_count INT DEFAULT 0;
