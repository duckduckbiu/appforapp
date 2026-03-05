-- Phase 2: Promoter / referral system
-- Tables: promoter_links, referral_attributions, promoter_clicks

-- ─── promoter_links ───────────────────────────────────────────────────────────

CREATE TABLE promoter_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code           TEXT UNIQUE NOT NULL,
  target_type    TEXT NOT NULL DEFAULT 'platform', -- 'platform' | 'app' | 'channel'
  target_id      TEXT,                             -- app slug or channel id (nullable)
  click_count    INTEGER NOT NULL DEFAULT 0,
  register_count INTEGER NOT NULL DEFAULT 0,
  revenue_total  BIGINT NOT NULL DEFAULT 0,        -- micro-USDC cumulative earnings
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ─── referral_attributions ────────────────────────────────────────────────────

CREATE TABLE referral_attributions (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id   UUID NOT NULL REFERENCES auth.users(id),
  link_id       UUID REFERENCES promoter_links(id),
  attributed_at TIMESTAMPTZ DEFAULT now()
);

-- ─── promoter_clicks ──────────────────────────────────────────────────────────

CREATE TABLE promoter_clicks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id    UUID NOT NULL REFERENCES promoter_links(id) ON DELETE CASCADE,
  ip_hash    TEXT,    -- sha256(ip) for dedup without storing raw IP
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE promoter_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promoter_clicks       ENABLE ROW LEVEL SECURITY;

-- promoter_links: owner can manage, anyone can read (needed for click attribution)
CREATE POLICY "promoter_links_own_all" ON promoter_links
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "promoter_links_public_read" ON promoter_links
  FOR SELECT USING (true);

-- referral_attributions: user and their referrer can view
CREATE POLICY "referral_attr_parties_read" ON referral_attributions
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = referrer_id);
-- Any logged-in user can write their own attribution (once at signup)
CREATE POLICY "referral_attr_self_insert" ON referral_attributions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- promoter_clicks: anonymous insert allowed; promoter can read their links' clicks
CREATE POLICY "promoter_clicks_insert" ON promoter_clicks
  FOR INSERT WITH CHECK (true);
CREATE POLICY "promoter_clicks_read_own" ON promoter_clicks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM promoter_links
      WHERE id = link_id AND user_id = auth.uid()
    )
  );

-- ─── click_count trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_link_click_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE promoter_links SET click_count = click_count + 1 WHERE id = NEW.link_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_link_click_count
AFTER INSERT ON promoter_clicks
FOR EACH ROW EXECUTE FUNCTION increment_link_click_count();
