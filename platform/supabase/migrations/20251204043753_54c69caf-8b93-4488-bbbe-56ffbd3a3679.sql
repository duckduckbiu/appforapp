-- 创建帖子解锁规则表
CREATE TABLE public.post_unlock_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  unlock_type TEXT NOT NULL DEFAULT 'likes', -- likes: 点赞解锁
  required_count INTEGER NOT NULL DEFAULT 1, -- 需要的点赞次数
  blur_intensity INTEGER NOT NULL DEFAULT 20, -- 模糊强度 (0-50)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建用户解锁状态表
CREATE TABLE public.post_unlock_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.post_unlock_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_unlock_status ENABLE ROW LEVEL SECURITY;

-- 解锁规则策略：所有人可查看，作者可管理
CREATE POLICY "所有人可查看解锁规则" 
ON public.post_unlock_rules FOR SELECT USING (true);

CREATE POLICY "作者可创建解锁规则" 
ON public.post_unlock_rules FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM posts 
    WHERE posts.id = post_unlock_rules.post_id 
    AND posts.author_id = auth.uid()
  )
);

CREATE POLICY "作者可删除解锁规则" 
ON public.post_unlock_rules FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM posts 
    WHERE posts.id = post_unlock_rules.post_id 
    AND posts.author_id = auth.uid()
  )
);

-- 解锁状态策略
CREATE POLICY "用户可查看自己的解锁状态" 
ON public.post_unlock_status FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "用户可创建自己的解锁状态" 
ON public.post_unlock_status FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- 创建索引
CREATE INDEX idx_post_unlock_rules_post_id ON public.post_unlock_rules(post_id);
CREATE INDEX idx_post_unlock_status_post_user ON public.post_unlock_status(post_id, user_id);