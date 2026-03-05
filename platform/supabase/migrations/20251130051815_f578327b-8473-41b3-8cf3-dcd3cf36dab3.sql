-- 启用 pg_trgm 扩展（支持模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 为 unique_username 创建 GIN trigram 索引（加速用户名搜索）
CREATE INDEX IF NOT EXISTS idx_profiles_unique_username_trgm 
ON public.profiles USING GIN (unique_username gin_trgm_ops);

-- 为 display_name 创建 GIN trigram 索引（加速昵称搜索）
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm 
ON public.profiles USING GIN (display_name gin_trgm_ops);

-- 创建用户搜索函数（支持用户名和昵称模糊搜索）
CREATE OR REPLACE FUNCTION public.search_users_by_name(
  search_query text,
  current_user_id uuid,
  result_limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  unique_username text,
  display_name text,
  avatar_url text,
  bio text,
  is_ai_avatar boolean,
  ai_avatar_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.unique_username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.is_ai_avatar,
    p.ai_avatar_id
  FROM profiles p
  WHERE (
    p.unique_username ILIKE '%' || search_query || '%' 
    OR p.display_name ILIKE '%' || search_query || '%'
  )
  AND p.id != current_user_id
  AND (p.privacy_settings->>'profile_visibility' = 'public' OR p.id = current_user_id)
  ORDER BY 
    CASE 
      WHEN p.unique_username ILIKE search_query || '%' THEN 1
      WHEN p.display_name ILIKE search_query || '%' THEN 2
      ELSE 3
    END,
    p.unique_username
  LIMIT result_limit;
$$;