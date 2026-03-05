-- Phase 2: Geo-restriction support
-- Adds allowed_regions column to apps + a user_geo_cache table

-- ─── allowed_regions on apps ──────────────────────────────────────────────────

ALTER TABLE apps ADD COLUMN IF NOT EXISTS allowed_regions TEXT[] DEFAULT NULL;
-- NULL  = available in all regions
-- e.g. '{US,CA}' = only US and Canada

COMMENT ON COLUMN apps.allowed_regions IS
  'ISO 3166-1 alpha-2 region codes allowed to access this app. NULL means all regions.';

-- ─── user_geo_cache ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_geo_cache (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  country   TEXT NOT NULL,        -- 2-letter ISO code, e.g. ''CN''
  cached_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_geo_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_cache_own" ON user_geo_cache
  FOR ALL USING (auth.uid() = user_id);
