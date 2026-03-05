-- 1. 修改 post_unlock_rules 表，添加解锁模式
ALTER TABLE public.post_unlock_rules 
ADD COLUMN IF NOT EXISTS unlock_mode text NOT NULL DEFAULT 'unified';

-- 添加约束确保 unlock_mode 只能是 unified 或 per_region
ALTER TABLE public.post_unlock_rules 
DROP CONSTRAINT IF EXISTS post_unlock_rules_unlock_mode_check;

ALTER TABLE public.post_unlock_rules 
ADD CONSTRAINT post_unlock_rules_unlock_mode_check 
CHECK (unlock_mode IN ('unified', 'per_region'));

-- 2. 修改 post_media 表，添加每张图片的打码区域
-- mask_regions 格式: [{ id, x, y, width, height, price }]
ALTER TABLE public.post_media 
ADD COLUMN IF NOT EXISTS mask_regions jsonb DEFAULT '[]'::jsonb;

-- 3. 修改 post_unlock_status 表，支持分区域解锁记录
ALTER TABLE public.post_unlock_status 
ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES public.post_media(id) ON DELETE CASCADE;

ALTER TABLE public.post_unlock_status 
ADD COLUMN IF NOT EXISTS region_id text;

-- 删除旧的唯一约束（如果存在）
ALTER TABLE public.post_unlock_status 
DROP CONSTRAINT IF EXISTS post_unlock_status_post_id_user_id_key;

-- 创建新的唯一约束，支持分区域解锁
-- 对于统一解锁：media_id 和 region_id 都为 NULL
-- 对于分区域解锁：记录具体的 media_id 和 region_id
CREATE UNIQUE INDEX IF NOT EXISTS post_unlock_status_unique_idx 
ON public.post_unlock_status (post_id, user_id, COALESCE(media_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(region_id, ''));

-- 4. 为 post_unlock_status 的 media_id 添加索引
CREATE INDEX IF NOT EXISTS idx_post_unlock_status_media_id 
ON public.post_unlock_status(media_id);

-- 5. 添加注释
COMMENT ON COLUMN public.post_unlock_rules.unlock_mode IS '解锁模式：unified=统一解锁所有区域，per_region=分区域解锁';
COMMENT ON COLUMN public.post_media.mask_regions IS '该图片的打码区域，格式：[{id, x, y, width, height, price}]，price 仅在 per_region 模式下使用';
COMMENT ON COLUMN public.post_unlock_status.media_id IS '解锁的媒体ID，统一模式下为NULL';
COMMENT ON COLUMN public.post_unlock_status.region_id IS '解锁的区域ID，统一模式下为NULL';