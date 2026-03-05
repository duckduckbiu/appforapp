-- Phase 1: User ban system
-- Allows admins to ban users from the platform

CREATE TABLE bans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by  UUID REFERENCES auth.users(id),
  reason     TEXT,
  expires_at TIMESTAMPTZ,        -- NULL = permanent ban
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bans ENABLE ROW LEVEL SECURITY;

-- Only admins can manage bans
CREATE POLICY "bans_admin_all" ON bans FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Banned users can read their own ban record (to display reason)
CREATE POLICY "bans_self_read" ON bans FOR SELECT
  USING (auth.uid() = user_id);
