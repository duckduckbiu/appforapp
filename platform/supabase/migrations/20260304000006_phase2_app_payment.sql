-- Phase 2: App Payment Gating
-- Adds app_category and payment_status to apps table.
-- Seeds platform_settings with the payment policy (no hardcoded values in code).

-- ─── Schema columns ──────────────────────────────────────────────────────────

ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS app_category TEXT NOT NULL DEFAULT 'general';
-- Allowed values (enforced by platform_settings.payment.valid_categories):
--   'general' | 'game' | 'social' | 'tool' | 'adult' | 'gambling' | 'finance'

ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
-- 'pending'    — not yet reviewed for platform-payment eligibility
-- 'enabled'    — wallet.charge allowed (admin must explicitly grant)
-- 'restricted' — platform payment permanently blocked; app must use its own payment

COMMENT ON COLUMN apps.app_category   IS 'Application category, controls default payment policy.';
COMMENT ON COLUMN apps.payment_status IS 'Platform-payment eligibility: pending | enabled | restricted.';

-- ─── Platform Settings: Payment Policy ───────────────────────────────────────
-- All parameters read by SDKHost at charge-time; change here, no redeploy needed.

INSERT INTO platform_settings (category, key, value, description)
VALUES
  (
    'payment',
    'valid_categories',
    '["general", "game", "social", "tool", "adult", "gambling", "finance"]'::jsonb,
    'Exhaustive list of valid app_category values. Update when adding new categories.'
  ),
  (
    'payment',
    'restricted_categories',
    '["gambling", "finance"]'::jsonb,
    'Categories permanently blocked from wallet.charge regardless of payment_status. Typically real-money-gambling and regulated-finance apps.'
  ),
  (
    'payment',
    'default_status_by_category',
    '{
      "general":  "pending",
      "game":     "pending",
      "social":   "pending",
      "tool":     "pending",
      "adult":    "restricted",
      "gambling": "restricted",
      "finance":  "restricted"
    }'::jsonb,
    'Default payment_status assigned when a new app is created. Admin can override per-app after review.'
  ),
  (
    'payment',
    'charge_error_message',
    '"此应用未开通平台支付，或其类别不支持平台支付"'::jsonb,
    'User-facing error message returned when wallet.charge is blocked by payment_status or restricted_categories.'
  )
ON CONFLICT (category, key) DO UPDATE
  SET value       = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at  = now();

-- ─── Back-fill existing apps ──────────────────────────────────────────────────
-- Default is already 'general' / 'pending' from ADD COLUMN defaults above,
-- so only the test seed app needs an explicit status for dev/testing:
UPDATE apps
SET payment_status = 'enabled'
WHERE slug = 'test-app'
  AND payment_status = 'pending';
