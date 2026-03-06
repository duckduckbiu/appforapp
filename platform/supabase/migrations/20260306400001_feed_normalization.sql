-- Phase 1B: Content normalization columns

ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS normalized_title TEXT;
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS reading_time_minutes SMALLINT;
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS raw_content TEXT;

-- Index for deduplication by content hash
CREATE INDEX IF NOT EXISTS idx_agg_feed_content_hash ON aggregated_feed(content_hash);

-- Trigram index for fuzzy title matching (pg_trgm already enabled)
CREATE INDEX IF NOT EXISTS idx_agg_feed_title_trgm
ON aggregated_feed USING GIN(normalized_title gin_trgm_ops);
