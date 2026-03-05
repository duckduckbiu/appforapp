-- App-scoped OpenID: 每个用户在每个应用中的唯一标识
-- 类似微信 openid，同一用户在不同应用拿到不同的 openid，防止跨应用追踪。
-- 前缀 ou_ 便于识别（类似微信 oXXXX）。
-- 独立于 user_installed_apps，卸载/重装 openid 不变。

CREATE TABLE app_user_openids (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id     UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  openid     TEXT UNIQUE NOT NULL DEFAULT 'ou_' || replace(gen_random_uuid()::text, '-', ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);

CREATE INDEX idx_app_user_openids_openid ON app_user_openids(openid);

-- RLS: 用户只能读自己的 openid 记录
ALTER TABLE app_user_openids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "openid_select_own" ON app_user_openids
  FOR SELECT USING (auth.uid() = user_id);

-- 辅助函数：获取或创建 openid（并发安全）
-- SECURITY DEFINER 确保函数有权限写入表，即使用户无直接 INSERT 权限
CREATE OR REPLACE FUNCTION get_or_create_openid(p_user_id UUID, p_app_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_openid TEXT;
BEGIN
  -- 先尝试读取
  SELECT openid INTO v_openid
  FROM app_user_openids
  WHERE user_id = p_user_id AND app_id = p_app_id;

  IF v_openid IS NOT NULL THEN
    RETURN v_openid;
  END IF;

  -- 不存在则插入（ON CONFLICT 处理并发）
  INSERT INTO app_user_openids (user_id, app_id)
  VALUES (p_user_id, p_app_id)
  ON CONFLICT (user_id, app_id) DO NOTHING
  RETURNING openid INTO v_openid;

  -- 如果被并发 INSERT 抢先，RETURNING 为 NULL，重新读取
  IF v_openid IS NULL THEN
    SELECT openid INTO v_openid
    FROM app_user_openids
    WHERE user_id = p_user_id AND app_id = p_app_id;
  END IF;

  RETURN v_openid;
END;
$$;
