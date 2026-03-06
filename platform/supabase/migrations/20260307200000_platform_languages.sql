-- Platform languages: admin controls which languages are available to users
CREATE TABLE IF NOT EXISTS platform_languages (
  code         TEXT PRIMARY KEY,
  label_native TEXT NOT NULL,
  label_en     TEXT NOT NULL,
  flag         TEXT NOT NULL DEFAULT '',
  is_enabled   BOOLEAN NOT NULL DEFAULT false,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE platform_languages ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "platform_languages_select" ON platform_languages
  FOR SELECT USING (true);

-- Only admins can modify
CREATE POLICY "platform_languages_admin_insert" ON platform_languages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "platform_languages_admin_update" ON platform_languages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "platform_languages_admin_delete" ON platform_languages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seed: zh and en enabled by default
INSERT INTO platform_languages (code, label_native, label_en, flag, is_enabled, sort_order) VALUES
  ('zh', '中文', 'Chinese', '🇨🇳', true, 1),
  ('en', 'English', 'English', '🇺🇸', true, 2)
ON CONFLICT (code) DO NOTHING;
