-- Phase 5: Feed item translations cache

CREATE TABLE IF NOT EXISTS feed_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES aggregated_feed(id) ON DELETE CASCADE,
  target_lang TEXT NOT NULL DEFAULT 'zh',
  translated_title TEXT,
  translated_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feed_id, target_lang)
);

ALTER TABLE feed_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_translations_public_read" ON feed_translations FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_feed_translations_feed ON feed_translations(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_translations_lookup ON feed_translations(feed_id, target_lang);
