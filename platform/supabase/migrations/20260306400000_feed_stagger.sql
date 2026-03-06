-- Phase 1A: Staggered fetching with batch groups

-- Add batch_group column for round-robin scheduling
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS batch_group INT DEFAULT 0;

-- Assign batch groups (0-5) to active sources
WITH numbered AS (
  SELECT id, (row_number() OVER (ORDER BY created_at))::int % 6 AS grp
  FROM feed_sources WHERE is_active = true
)
UPDATE feed_sources SET batch_group = numbered.grp
FROM numbered WHERE feed_sources.id = numbered.id;
