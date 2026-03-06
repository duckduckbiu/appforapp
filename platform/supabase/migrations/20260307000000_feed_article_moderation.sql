-- ============================================================
-- Feed Article Moderation: status, reports, comments
-- ============================================================

-- 1. Add status column to aggregated_feed
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
CREATE INDEX IF NOT EXISTS idx_agg_feed_status ON aggregated_feed(status);

-- 2. Add comment_count cache column
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;

-- 3. Admin write policy for aggregated_feed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'aggregated_feed_admin_all'
  ) THEN
    CREATE POLICY "aggregated_feed_admin_all" ON aggregated_feed
      FOR ALL USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ============================================================
-- feed_item_reports — 举报系统
-- ============================================================
CREATE TABLE IF NOT EXISTS feed_item_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES aggregated_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,           -- spam, misleading, inappropriate, copyright, other
  details TEXT,                   -- optional free-text description
  status TEXT DEFAULT 'pending',  -- pending, resolved_approved, resolved_rejected, resolved_hidden
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT
);

ALTER TABLE feed_item_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "feed_reports_user_insert" ON feed_item_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own reports
CREATE POLICY "feed_reports_user_read" ON feed_item_reports
  FOR SELECT USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "feed_reports_admin_all" ON feed_item_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_feed_reports_feed ON feed_item_reports(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_reports_status ON feed_item_reports(status);
CREATE INDEX IF NOT EXISTS idx_feed_reports_created ON feed_item_reports(created_at DESC);

-- ============================================================
-- feed_item_comments — 评论系统
-- ============================================================
CREATE TABLE IF NOT EXISTS feed_item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES aggregated_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES feed_item_comments(id) ON DELETE CASCADE,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feed_item_comments ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "feed_comments_public_read" ON feed_item_comments
  FOR SELECT USING (true);

-- Users can insert own comments
CREATE POLICY "feed_comments_user_insert" ON feed_item_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own comments
CREATE POLICY "feed_comments_user_update" ON feed_item_comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "feed_comments_admin_all" ON feed_item_comments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_feed_comments_feed ON feed_item_comments(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_parent ON feed_item_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user ON feed_item_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_created ON feed_item_comments(created_at DESC);

-- ============================================================
-- Trigger: auto-update comment_count on aggregated_feed
-- ============================================================
CREATE OR REPLACE FUNCTION update_feed_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE aggregated_feed SET comment_count = comment_count + 1 WHERE id = NEW.feed_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE aggregated_feed SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.feed_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feed_comment_count ON feed_item_comments;
CREATE TRIGGER trg_feed_comment_count
  AFTER INSERT OR DELETE ON feed_item_comments
  FOR EACH ROW EXECUTE FUNCTION update_feed_comment_count();
