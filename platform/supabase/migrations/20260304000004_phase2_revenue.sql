-- Phase 2: Revenue splitting engine
-- Tables: app_transactions, revenue_splits, role_earnings
-- The 5-way split logic runs entirely inside a SECURITY DEFINER trigger so
-- SDKHost only needs to INSERT into app_transactions.

-- ─── app_transactions ─────────────────────────────────────────────────────────

CREATE TABLE app_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  channel_id  UUID REFERENCES channels(id),      -- NULL if not opened from a channel
  amount      BIGINT NOT NULL,                    -- micro-USDC (positive)
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── revenue_splits ───────────────────────────────────────────────────────────

CREATE TABLE revenue_splits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES app_transactions(id) ON DELETE CASCADE,
  app_id         UUID NOT NULL REFERENCES apps(id),
  role           TEXT NOT NULL,  -- 'platform'|'developer'|'channel'|'promoter'|'app_reserve'
  recipient_id   UUID REFERENCES auth.users(id), -- NULL for 'platform' role
  amount         BIGINT NOT NULL,
  bps            INTEGER NOT NULL,               -- basis points (/10000)
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ─── role_earnings ────────────────────────────────────────────────────────────

CREATE TABLE role_earnings (
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  role              TEXT NOT NULL,  -- 'developer'|'channel_owner'|'promoter'
  period            TEXT NOT NULL,  -- 'YYYY-MM'
  total_amount      BIGINT NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, role, period)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE app_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_splits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_earnings    ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions (payer side)
CREATE POLICY "app_tx_user_read" ON app_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Developers can see transactions involving their apps
CREATE POLICY "app_tx_dev_read" ON app_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM apps WHERE id = app_id AND developer_id = auth.uid())
  );

-- Channel owners can see transactions that occurred in their channels
CREATE POLICY "app_tx_channel_read" ON app_transactions
  FOR SELECT USING (
    channel_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM channels WHERE id = channel_id AND owner_id = auth.uid())
  );

-- Recipients can view their own revenue split records
CREATE POLICY "splits_recipient_read" ON revenue_splits
  FOR SELECT USING (auth.uid() = recipient_id);

-- Users can view their own monthly earnings
CREATE POLICY "earnings_self_read" ON role_earnings
  FOR SELECT USING (auth.uid() = user_id);

-- ─── 5-way Revenue Split Trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_revenue_split()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_developer_id  UUID;
  v_channel_owner UUID;
  v_promoter_id   UUID;
  -- fixed BPS constants
  v_plat_bps  CONSTANT INTEGER := 500;
  v_dev_bps   CONSTANT INTEGER := 7000;
  v_chan_bps  CONSTANT INTEGER := 1500;
  v_prom_bps  CONSTANT INTEGER := 500;
  v_app_bps   CONSTANT INTEGER := 500;
  -- amounts
  v_plat_amt  BIGINT;
  v_dev_amt   BIGINT;
  v_chan_amt  BIGINT := 0;
  v_prom_amt  BIGINT := 0;
  v_app_amt   BIGINT;
  v_period    TEXT;
BEGIN
  v_period := to_char(NEW.created_at, 'YYYY-MM');

  -- Resolve parties
  SELECT developer_id INTO v_developer_id FROM apps WHERE id = NEW.app_id;

  IF NEW.channel_id IS NOT NULL THEN
    SELECT owner_id INTO v_channel_owner FROM channels WHERE id = NEW.channel_id;
  END IF;

  SELECT referrer_id INTO v_promoter_id
    FROM referral_attributions
   WHERE user_id = NEW.user_id;

  -- Calculate amounts
  v_plat_amt := (NEW.amount * v_plat_bps) / 10000;
  v_app_amt  := (NEW.amount * v_app_bps)  / 10000;

  IF v_channel_owner IS NOT NULL THEN
    v_chan_amt := (NEW.amount * v_chan_bps) / 10000;
  END IF;

  IF v_promoter_id IS NOT NULL THEN
    v_prom_amt := (NEW.amount * v_prom_bps) / 10000;
  END IF;

  -- Developer gets the remainder (includes unclaimed channel/promoter shares)
  v_dev_amt := NEW.amount - v_plat_amt - v_app_amt - v_chan_amt - v_prom_amt;

  -- ── Insert split records ──────────────────────────────────────────────────
  INSERT INTO revenue_splits (transaction_id, app_id, role, recipient_id, amount, bps)
  VALUES
    (NEW.id, NEW.app_id, 'platform',    NULL,           v_plat_amt, v_plat_bps),
    (NEW.id, NEW.app_id, 'developer',   v_developer_id, v_dev_amt,  v_dev_bps),
    (NEW.id, NEW.app_id, 'app_reserve', v_developer_id, v_app_amt,  v_app_bps);

  IF v_channel_owner IS NOT NULL THEN
    INSERT INTO revenue_splits (transaction_id, app_id, role, recipient_id, amount, bps)
    VALUES (NEW.id, NEW.app_id, 'channel', v_channel_owner, v_chan_amt, v_chan_bps);
  END IF;

  IF v_promoter_id IS NOT NULL THEN
    INSERT INTO revenue_splits (transaction_id, app_id, role, recipient_id, amount, bps)
    VALUES (NEW.id, NEW.app_id, 'promoter', v_promoter_id, v_prom_amt, v_prom_bps);
  END IF;

  -- ── Credit wallets ───────────────────────────────────────────────────────
  -- Developer: receives developer share + app_reserve share
  UPDATE wallets
     SET balance = balance + v_dev_amt + v_app_amt
   WHERE user_id = v_developer_id;

  IF v_channel_owner IS NOT NULL THEN
    UPDATE wallets SET balance = balance + v_chan_amt WHERE user_id = v_channel_owner;
  END IF;

  IF v_promoter_id IS NOT NULL THEN
    UPDATE wallets SET balance = balance + v_prom_amt WHERE user_id = v_promoter_id;
    -- Also update the promoter link's cumulative revenue
    UPDATE promoter_links
       SET revenue_total = revenue_total + v_prom_amt
     WHERE user_id = v_promoter_id;
  END IF;

  -- ── Update monthly earnings summary ──────────────────────────────────────
  INSERT INTO role_earnings (user_id, role, period, total_amount, transaction_count)
  VALUES (v_developer_id, 'developer', v_period, v_dev_amt + v_app_amt, 1)
  ON CONFLICT (user_id, role, period) DO UPDATE
    SET total_amount      = role_earnings.total_amount + EXCLUDED.total_amount,
        transaction_count = role_earnings.transaction_count + 1,
        updated_at        = now();

  IF v_channel_owner IS NOT NULL THEN
    INSERT INTO role_earnings (user_id, role, period, total_amount, transaction_count)
    VALUES (v_channel_owner, 'channel_owner', v_period, v_chan_amt, 1)
    ON CONFLICT (user_id, role, period) DO UPDATE
      SET total_amount      = role_earnings.total_amount + EXCLUDED.total_amount,
          transaction_count = role_earnings.transaction_count + 1,
          updated_at        = now();
  END IF;

  IF v_promoter_id IS NOT NULL THEN
    INSERT INTO role_earnings (user_id, role, period, total_amount, transaction_count)
    VALUES (v_promoter_id, 'promoter', v_period, v_prom_amt, 1)
    ON CONFLICT (user_id, role, period) DO UPDATE
      SET total_amount      = role_earnings.total_amount + EXCLUDED.total_amount,
          transaction_count = role_earnings.transaction_count + 1,
          updated_at        = now();
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_revenue_split
AFTER INSERT ON app_transactions
FOR EACH ROW EXECUTE FUNCTION process_revenue_split();
