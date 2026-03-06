-- Refresh deduplicated_feed view to include new columns
-- (polished_title, polished_content, ai_status, images, videos, etc.)
-- PostgreSQL views with SELECT * capture columns at creation time,
-- so we need to DROP + recreate after adding columns to aggregated_feed.

DROP VIEW IF EXISTS deduplicated_feed;

CREATE VIEW deduplicated_feed AS
SELECT
  f.*,
  fc.article_count AS similar_count,
  fc.id AS cluster_id
FROM feed_clusters fc
JOIN aggregated_feed f ON f.id = fc.primary_feed_id
WHERE fc.primary_feed_id IS NOT NULL
ORDER BY f.published_at DESC NULLS LAST;

-- Re-apply RLS-like access (views inherit from underlying tables)
-- No RLS needed on views directly, but grant access
GRANT SELECT ON deduplicated_feed TO anon, authenticated;
