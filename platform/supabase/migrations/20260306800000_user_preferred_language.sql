-- Add preferred_language to profiles for news content filtering
-- Syncs with i18n UI language; controls which news sources are prioritized

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'zh';

-- Index for feed queries that join on user language
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language
  ON profiles(preferred_language);

COMMENT ON COLUMN profiles.preferred_language IS
  'User preferred content language (zh, en, ja, ko...). Controls UI i18n and news feed language priority.';
