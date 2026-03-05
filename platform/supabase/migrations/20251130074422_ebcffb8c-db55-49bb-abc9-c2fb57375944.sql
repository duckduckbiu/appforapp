-- 创建安全函数来设置第一个管理员
CREATE OR REPLACE FUNCTION public.setup_first_admin(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- 检查是否已有管理员
  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles
  WHERE role = 'admin';
  
  -- 如果已有管理员，抛出错误
  IF admin_count > 0 THEN
    RAISE EXCEPTION '系统已有管理员，无法再次初始化';
  END IF;
  
  -- 设置当前用户为管理员
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;