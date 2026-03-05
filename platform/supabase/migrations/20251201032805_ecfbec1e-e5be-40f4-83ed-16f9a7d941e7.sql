-- 为 ai_avatar_permissions 表添加对话轮数限制字段
ALTER TABLE public.ai_avatar_permissions
ADD COLUMN chat_max_rounds integer DEFAULT 30,
ADD COLUMN chat_unlimited_rounds boolean DEFAULT false;

COMMENT ON COLUMN public.ai_avatar_permissions.chat_max_rounds IS 'AI 自动回复的最大轮数限制，默认 30 轮';
COMMENT ON COLUMN public.ai_avatar_permissions.chat_unlimited_rounds IS '是否允许无限轮对话，如果为 true 则忽略 chat_max_rounds';