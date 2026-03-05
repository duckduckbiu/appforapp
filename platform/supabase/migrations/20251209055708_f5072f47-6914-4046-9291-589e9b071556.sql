-- 给 posts 表添加位置相关字段
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS location_name text;

-- 添加空间索引以优化附近查询
CREATE INDEX IF NOT EXISTS idx_posts_location ON public.posts (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 添加注释
COMMENT ON COLUMN public.posts.latitude IS '帖子发布位置的纬度';
COMMENT ON COLUMN public.posts.longitude IS '帖子发布位置的经度';
COMMENT ON COLUMN public.posts.location_name IS '帖子发布位置的名称';