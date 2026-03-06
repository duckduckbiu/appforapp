-- Phase 4: Feed item interactions (likes, bookmarks, comments)

-- ── Likes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_item_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES aggregated_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feed_id, user_id)
);

ALTER TABLE feed_item_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_likes_read" ON feed_item_likes FOR SELECT USING (true);
CREATE POLICY "feed_likes_insert" ON feed_item_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feed_likes_delete" ON feed_item_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feed_likes_feed ON feed_item_likes(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_user ON feed_item_likes(user_id);

-- ── Bookmarks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_item_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES aggregated_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feed_id, user_id)
);

ALTER TABLE feed_item_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_bookmarks_read" ON feed_item_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "feed_bookmarks_insert" ON feed_item_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feed_bookmarks_delete" ON feed_item_bookmarks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feed_bookmarks_user ON feed_item_bookmarks(user_id);

-- ── Like count cache on aggregated_feed ──────────────────────────────
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0;
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS bookmark_count INT DEFAULT 0;

-- ── Trigger: auto-update like_count ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_feed_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE aggregated_feed SET like_count = like_count + 1 WHERE id = NEW.feed_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE aggregated_feed SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.feed_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feed_like_count ON feed_item_likes;
CREATE TRIGGER trg_feed_like_count
  AFTER INSERT OR DELETE ON feed_item_likes
  FOR EACH ROW EXECUTE FUNCTION update_feed_like_count();

-- ── Trigger: auto-update bookmark_count ──────────────────────────────
CREATE OR REPLACE FUNCTION update_feed_bookmark_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE aggregated_feed SET bookmark_count = bookmark_count + 1 WHERE id = NEW.feed_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE aggregated_feed SET bookmark_count = GREATEST(0, bookmark_count - 1) WHERE id = OLD.feed_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feed_bookmark_count ON feed_item_bookmarks;
CREATE TRIGGER trg_feed_bookmark_count
  AFTER INSERT OR DELETE ON feed_item_bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_feed_bookmark_count();
