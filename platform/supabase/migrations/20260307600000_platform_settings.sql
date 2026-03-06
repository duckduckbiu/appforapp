-- platform_settings: 平台全局配置表（key-value）
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "platform_settings_select"
  ON platform_settings FOR SELECT
  USING (true);

-- 仅 admin 可写
CREATE POLICY "platform_settings_admin_write"
  ON platform_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 初始配置
INSERT INTO platform_settings (key, value, description) VALUES
  ('fundus_fetch_interval_minutes', '30',  'fundus 抓取最小间隔（分钟），GitHub Actions 每 10 分钟触发一次，但脚本仅在间隔到期后才真正运行'),
  ('fundus_last_fetch_at',          '',    'fundus 上次成功完整运行的 ISO 时间戳（由脚本写入）')
ON CONFLICT (key) DO NOTHING;
