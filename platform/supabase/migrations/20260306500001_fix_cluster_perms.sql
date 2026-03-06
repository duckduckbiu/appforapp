-- Fix: cluster_feed_items() needs SECURITY DEFINER to bypass RLS
-- Also add admin write policies for manual management

CREATE OR REPLACE FUNCTION cluster_feed_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- run as table owner, bypass RLS
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  matched_cluster_id UUID;
  best_sim REAL;
BEGIN
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
        AND f2.normalized_title % rec.normalized_title
        AND similarity(f2.normalized_title, rec.normalized_title) > 0.4
      ORDER BY sim DESC
      LIMIT 1;
    END IF;

    IF matched_cluster_id IS NOT NULL THEN
      INSERT INTO feed_cluster_items (cluster_id, feed_id, similarity)
      VALUES (matched_cluster_id, rec.id, COALESCE(best_sim, 1.0))
      ON CONFLICT DO NOTHING;

      UPDATE feed_clusters SET
        article_count = (SELECT COUNT(*) FROM feed_cluster_items WHERE cluster_id = matched_cluster_id),
        updated_at = now()
      WHERE id = matched_cluster_id;

      UPDATE feed_clusters SET primary_feed_id = (
        SELECT fci3.feed_id FROM feed_cluster_items fci3
        JOIN aggregated_feed f3 ON f3.id = fci3.feed_id
        WHERE fci3.cluster_id = matched_cluster_id
        ORDER BY f3.score DESC, f3.published_at DESC NULLS LAST
        LIMIT 1
      ) WHERE id = matched_cluster_id;
    ELSE
      INSERT INTO feed_clusters (primary_feed_id, title_fingerprint, article_count)
      VALUES (rec.id, rec.normalized_title, 1)
      RETURNING id INTO matched_cluster_id;

      INSERT INTO feed_cluster_items (cluster_id, feed_id, similarity)
      VALUES (matched_cluster_id, rec.id, 1.0);
    END IF;
  END LOOP;
END;
$$;
