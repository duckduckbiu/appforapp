-- Phase 2 Step 4: Register Rich Game in the Bill.ai apps table
-- Rich Game is the first third-party app on the platform.
-- Category: gambling (real-money blockchain game)
-- Payment: restricted — Rich Game uses its own USDC/USDT wallet, NOT Bill.ai wallet.charge

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
  version
)
VALUES (
  'rich-game',
  'Rich Game',
  '少数票链上博弈游戏 — 少数票获胜的去中心化区块链博弈，支持 USDC/USDT 入场',
  'http://localhost:4200',   -- dev: Rich Game runs at localhost:4200; update to prod URL when deployed
  'approved',
  'gambling',
  'restricted',
  '18+',
  true,
  '1.0.0'
)
ON CONFLICT (slug) DO UPDATE
  SET name           = EXCLUDED.name,
      description    = EXCLUDED.description,
      app_category   = EXCLUDED.app_category,
      payment_status = EXCLUDED.payment_status,
      status         = EXCLUDED.status,
      age_rating     = EXCLUDED.age_rating,
      updated_at     = now();
