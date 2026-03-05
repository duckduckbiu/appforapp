-- 1. 创建 trigger（如果不存在）
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. 为已存在但没有 profile 的用户创建 profile
INSERT INTO public.profiles (id, unique_username, display_name)
SELECT 
  u.id,
  'user_' || substr(md5(random()::text), 1, 8),
  COALESCE(u.raw_user_meta_data->>'display_name', 'user_' || substr(md5(random()::text), 1, 8))
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;