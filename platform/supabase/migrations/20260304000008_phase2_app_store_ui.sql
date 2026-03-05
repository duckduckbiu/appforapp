-- Phase 2: App Store UI Enhancements
-- Adds is_official and is_featured flags to apps table.
-- is_official = true  → Platform-published apps (no developer, curated by Bill.ai)
-- is_featured = true  → Highlighted in the "推荐" tab (can be set by admin)

ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN apps.is_official IS 'True for platform-published apps. Shown with 官方 badge.';
COMMENT ON COLUMN apps.is_featured  IS 'True for apps featured in the 推荐 tab.';

-- ─── Mark existing platform apps as official + featured ───────────────────

UPDATE apps SET is_official = true, is_featured = true WHERE slug = 'test-app';
UPDATE apps SET is_official = true, is_featured = true WHERE slug = 'rich-game';

-- ─── Upsert Rich Game (in case migration 20260304000007 was not applied) ──

INSERT INTO apps (
  slug,
  name,
  description,
  manifest_url,
  status,
  app_category,
  payment_status,
  age_rating,
  is_free,
  version,
  is_official,
  is_featured
)
VALUES (
  'rich-game',
  'Rich Game',
  '少数票链上博弈游戏 — 少数票获胜的去中心化区块链博弈，支持 USDC/USDT 入场',
  'http://localhost:4200',
  'approved',
  'gambling',
  'restricted',
  '18+',
  true,
  '1.0.0',
  true,
  true
)
ON CONFLICT (slug) DO UPDATE
  SET name           = EXCLUDED.name,
      description    = EXCLUDED.description,
      app_category   = EXCLUDED.app_category,
      payment_status = EXCLUDED.payment_status,
      status         = EXCLUDED.status,
      age_rating     = EXCLUDED.age_rating,
      is_official    = EXCLUDED.is_official,
      is_featured    = EXCLUDED.is_featured,
      updated_at     = now();
