-- Phase 1: App Store
-- apps 注册表

CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  manifest_url TEXT NOT NULL,
  developer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'draft',
  age_rating TEXT NOT NULL DEFAULT 'all',
  is_free BOOLEAN NOT NULL DEFAULT true,
  price_credits INTEGER DEFAULT 0,
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_installed_apps 用户已安装应用
CREATE TABLE IF NOT EXISTS user_installed_apps (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);

-- RLS
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_installed_apps ENABLE ROW LEVEL SECURITY;

-- 所有人可查看已审核应用
CREATE POLICY "apps_public_read" ON apps
  FOR SELECT USING (status = 'approved');

-- 管理员可看所有并修改
CREATE POLICY "apps_admin_all" ON apps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 开发者可以看自己的应用
CREATE POLICY "apps_developer_own" ON apps
  FOR SELECT USING (developer_id = auth.uid());

-- user_installed_apps RLS
CREATE POLICY "installed_apps_select" ON user_installed_apps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "installed_apps_insert" ON user_installed_apps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "installed_apps_delete" ON user_installed_apps
  FOR DELETE USING (auth.uid() = user_id);

-- 安装数量自动更新 trigger
CREATE OR REPLACE FUNCTION update_app_install_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE apps SET install_count = install_count + 1 WHERE id = NEW.app_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE apps SET install_count = GREATEST(0, install_count - 1) WHERE id = OLD.app_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_app_install_count
AFTER INSERT OR DELETE ON user_installed_apps
FOR EACH ROW EXECUTE FUNCTION update_app_install_count();

-- 种子数据：测试应用
INSERT INTO apps (slug, name, description, manifest_url, status)
VALUES (
  'test-app',
  'SDK 测试应用',
  '验证 Bill.ai App SDK 通信的测试应用，包含 user、wallet、ui 模块演示。',
  '/test-app/index.html',
  'approved'
) ON CONFLICT (slug) DO NOTHING;
