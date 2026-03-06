-- Phase 2: Feed deduplication & similar news clustering
-- Uses content_hash for exact dedup + pg_trgm for fuzzy matching

-- Ensure pg_trgm is available (already enabled from Phase 1B, but safe to re-run)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Feed clusters table ──────────────────────────────────────────────
-- Groups similar articles together; the "primary" is the most popular

CREATE TABLE IF NOT EXISTS feed_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_feed_id UUID REFERENCES aggregated_feed(id) ON DELETE SET NULL,
  title_fingerprint TEXT,          -- normalized title for matching
  article_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feed_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_clusters_public_read" ON feed_clusters FOR SELECT USING (true);

-- Link table: many feed items → one cluster
CREATE TABLE IF NOT EXISTS feed_cluster_items (
  cluster_id UUID REFERENCES feed_clusters(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES aggregated_feed(id) ON DELETE CASCADE,
  similarity REAL DEFAULT 1.0,
  PRIMARY KEY (cluster_id, feed_id)
);

ALTER TABLE feed_cluster_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_cluster_items_public_read" ON feed_cluster_items FOR SELECT USING (true);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_feed_cluster_items_feed ON feed_cluster_items(feed_id);

-- ── cluster_feed_items() function ────────────────────────────────────
-- Called after each fetch batch to cluster similar articles

CREATE OR REPLACE FUNCTION cluster_feed_items()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  matched_cluster_id UUID;
  best_sim REAL;
BEGIN
  -- Process unclustered feed items (those not in any cluster)
  FOR rec IN
    SELECT f.id, f.normalized_title, f.content_hash, f.score, f.published_at
    FROM aggregated_feed f
    LEFT JOIN feed_cluster_items fci ON fci.feed_id = f.id
    WHERE fci.feed_id IS NULL
      AND f.normalized_title IS NOT NULL
      AND f.normalized_title != ''
    ORDER BY f.published_at DESC NULLS LAST
    LIMIT 500
  LOOP
    matched_cluster_id := NULL;
    best_sim := 0;

    -- 1. Exact hash match
    SELECT fc.id INTO matched_cluster_id
    FROM feed_clusters fc
    JOIN feed_cluster_items fci2 ON fci2.cluster_id = fc.id
    JOIN aggregated_feed f2 ON f2.id = fci2.feed_id
    WHERE f2.content_hash = rec.content_hash
      AND rec.content_hash IS NOT NULL
    LIMIT 1;

    -- 2. Fuzzy title match (pg_trgm similarity > 0.4)
    IF matched_cluster_id IS NULL THEN
      SELECT fc.id, similarity(f2.normalized_title, rec.normalized_title) AS sim
      INTO matched_cluster_id, best_sim
      FROM feed_clusters fc
      JOIN aggregated_feed f2 ON f2.id = fc.primary_feed_id
      WHERE f2.normalized_title IS NOT NULL
        AND f2.normalized_title % rec.normalized_title  -- uses GIN index
        AND similarity(f2.normalized_title, rec.normalized_title) > 0.4
      ORDER BY sim DESC
      LIMIT 1;
    END IF;

    IF matched_cluster_id IS NOT NULL THEN
      -- Add to existing cluster
      INSERT INTO feed_cluster_items (cluster_id, feed_id, similarity)
      VALUES (matched_cluster_id, rec.id, COALESCE(best_sim, 1.0))
      ON CONFLICT DO NOTHING;

      -- Update cluster count
      UPDATE feed_clusters SET
        article_count = (SELECT COUNT(*) FROM feed_cluster_items WHERE cluster_id = matched_cluster_id),
        updated_at = now()
      WHERE id = matched_cluster_id;

      -- Update primary to highest-score article
      UPDATE feed_clusters SET primary_feed_id = (
        SELECT fci3.feed_id FROM feed_cluster_items fci3
        JOIN aggregated_feed f3 ON f3.id = fci3.feed_id
        WHERE fci3.cluster_id = matched_cluster_id
        ORDER BY f3.score DESC, f3.published_at DESC
        LIMIT 1
      ) WHERE id = matched_cluster_id;
    ELSE
      -- Create new cluster
      INSERT INTO feed_clusters (primary_feed_id, title_fingerprint, article_count)
      VALUES (rec.id, rec.normalized_title, 1)
      RETURNING id INTO matched_cluster_id;

      INSERT INTO feed_cluster_items (cluster_id, feed_id, similarity)
      VALUES (matched_cluster_id, rec.id, 1.0);
    END IF;
  END LOOP;
END;
$$;

-- ── Deduplicated feed view ───────────────────────────────────────────
-- Shows one row per cluster (the primary/best article) + similar_count

CREATE OR REPLACE VIEW deduplicated_feed AS
SELECT
  f.*,
  fc.article_count AS similar_count,
  fc.id AS cluster_id
FROM feed_clusters fc
JOIN aggregated_feed f ON f.id = fc.primary_feed_id
WHERE fc.primary_feed_id IS NOT NULL
ORDER BY f.published_at DESC NULLS LAST;
