-- Phase 1: Channel system
-- channels, channel_members, channel_apps tables

-- ─── channels ─────────────────────────────────────────────────────────────────

CREATE TABLE channels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  icon_url     TEXT,
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count INTEGER NOT NULL DEFAULT 0,
  is_public    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ─── channel_members ──────────────────────────────────────────────────────────

CREATE TABLE channel_members (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  joined_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- ─── channel_apps ─────────────────────────────────────────────────────────────

CREATE TABLE channel_apps (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  app_id     UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  added_by   UUID REFERENCES auth.users(id),
  added_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, app_id)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_apps ENABLE ROW LEVEL SECURITY;

-- Public channels are visible to everyone
CREATE POLICY "channels_public_read" ON channels FOR SELECT USING (is_public = true);
-- Channel owner can update their channel
CREATE POLICY "channels_owner_update" ON channels FOR UPDATE USING (auth.uid() = owner_id);
-- Any authenticated user can create a channel (as owner)
CREATE POLICY "channels_auth_insert" ON channels FOR INSERT WITH CHECK (auth.uid() = owner_id);
-- Channel owner can delete their channel
CREATE POLICY "channels_owner_delete" ON channels FOR DELETE USING (auth.uid() = owner_id);

-- Members can view their own membership and channel owner can view all members
CREATE POLICY "channel_members_select" ON channel_members FOR SELECT
  USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM channels WHERE id = channel_id AND owner_id = auth.uid()));
-- Users can join channels themselves
CREATE POLICY "channel_members_insert" ON channel_members FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Users can leave channels themselves
CREATE POLICY "channel_members_delete" ON channel_members FOR DELETE USING (auth.uid() = user_id);

-- Public channel apps are visible to everyone
CREATE POLICY "channel_apps_select" ON channel_apps FOR SELECT
  USING (EXISTS (SELECT 1 FROM channels WHERE id = channel_id AND is_public = true));
-- Channel owner can add apps
CREATE POLICY "channel_apps_owner_insert" ON channel_apps FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM channels WHERE id = channel_id AND owner_id = auth.uid()));
-- Channel owner can remove apps
CREATE POLICY "channel_apps_owner_delete" ON channel_apps FOR DELETE
  USING (EXISTS (SELECT 1 FROM channels WHERE id = channel_id AND owner_id = auth.uid()));

-- ─── Auto-update member_count trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_channel_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE channels SET member_count = member_count + 1 WHERE id = NEW.channel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE channels SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.channel_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_channel_member_count
AFTER INSERT OR DELETE ON channel_members
FOR EACH ROW EXECUTE FUNCTION update_channel_member_count();
