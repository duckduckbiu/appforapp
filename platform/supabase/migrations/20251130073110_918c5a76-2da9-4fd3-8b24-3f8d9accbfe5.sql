-- 第一步：创建用户角色系统

-- 1. 创建角色枚举
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. 创建用户角色表
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. 启用 RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. 创建安全定义函数检查角色
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. 用户角色表的 RLS 策略
CREATE POLICY "用户可以查看自己的角色"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "只有管理员可以管理角色"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 第二步：修复 platform_settings RLS 策略

-- 删除现有过于宽松的策略
DROP POLICY IF EXISTS "Allow authenticated read platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Allow authenticated write platform_settings" ON public.platform_settings;

-- 新策略：所有已认证用户可读取配置
CREATE POLICY "已认证用户可读取平台设置"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

-- 新策略：只有管理员可以修改平台设置
CREATE POLICY "只有管理员可以修改平台设置"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "只有管理员可以更新平台设置"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "只有管理员可以删除平台设置"
  ON public.platform_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 第三步：修复 permission_audit_logs RLS 策略

-- 删除现有可被滥用的 INSERT 策略
DROP POLICY IF EXISTS "系统可以插入审计日志" ON public.permission_audit_logs;

-- 不需要新的 INSERT 策略，因为 log_permission_change 函数
-- 已经是 SECURITY DEFINER，可以绕过 RLS
-- 这样只有通过官方函数才能插入日志，无法直接 INSERT 伪造数据

-- 第四步：加强 profiles 表 RLS

-- 删除现有策略
DROP POLICY IF EXISTS "用户可以查看公开资料" ON public.profiles;

-- 新策略：只有已认证用户可查看公开资料
CREATE POLICY "已认证用户可查看公开资料"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (privacy_settings->>'profile_visibility' = 'public')
    OR (id = auth.uid())
    OR (is_ai_avatar = true)
  );