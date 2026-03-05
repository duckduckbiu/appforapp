-- ============================================
-- 多端同步架构 - 数据库结构设计
-- ============================================

-- 1. 创建分布式任务锁表
CREATE TABLE IF NOT EXISTS public.ai_task_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES public.ai_avatars(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL, -- 'auto_reply', 'scheduled_action', etc.
  task_key TEXT NOT NULL, -- 唯一标识任务的key（如 message_id, conversation_id）
  locked_by TEXT NOT NULL, -- 设备/进程标识符（device_id + session_id）
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- 锁过期时间（防止死锁）
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(avatar_id, task_type, task_key) -- 确保同一任务只能有一个锁
);

-- 2. 创建长期记忆系统表
CREATE TABLE IF NOT EXISTS public.ai_avatar_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES public.ai_avatars(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL, -- 'fact', 'preference', 'relationship', 'event', 'emotion'
  subject TEXT NOT NULL, -- 记忆主题（用户名、话题、地点等）
  content TEXT NOT NULL, -- 记忆内容描述
  importance INTEGER NOT NULL DEFAULT 5 CHECK (importance >= 1 AND importance <= 10), -- 重要性 1-10
  emotional_tag TEXT, -- 情感标签 'positive', 'negative', 'neutral'
  source_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL, -- 记忆来源
  source_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  access_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true, -- 是否激活（可以"遗忘"记忆）
  metadata JSONB DEFAULT '{}'::jsonb -- 额外元数据
);

-- 为记忆表创建索引
CREATE INDEX IF NOT EXISTS idx_ai_memory_avatar_type ON public.ai_avatar_memory(avatar_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_memory_subject ON public.ai_avatar_memory(subject);
CREATE INDEX IF NOT EXISTS idx_ai_memory_importance ON public.ai_avatar_memory(importance DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memory_accessed ON public.ai_avatar_memory(last_accessed_at DESC);

-- 3. 创建会话上下文缓存表（用于长对话摘要）
CREATE TABLE IF NOT EXISTS public.ai_conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES public.ai_avatars(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  context_summary TEXT, -- AI 生成的会话摘要
  key_points JSONB DEFAULT '[]'::jsonb, -- 关键要点列表
  last_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(avatar_id, conversation_id)
);

-- 4. 创建分布式锁管理函数

-- 尝试获取任务锁
CREATE OR REPLACE FUNCTION public.acquire_task_lock(
  p_avatar_id UUID,
  p_task_type TEXT,
  p_task_key TEXT,
  p_locked_by TEXT,
  p_lock_duration_seconds INTEGER DEFAULT 300 -- 默认5分钟过期
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_acquired BOOLEAN := false;
BEGIN
  -- 先清理过期的锁
  DELETE FROM public.ai_task_locks
  WHERE expires_at < now();
  
  -- 尝试插入新锁
  INSERT INTO public.ai_task_locks (
    avatar_id,
    task_type,
    task_key,
    locked_by,
    expires_at
  )
  VALUES (
    p_avatar_id,
    p_task_type,
    p_task_key,
    p_locked_by,
    now() + (p_lock_duration_seconds || ' seconds')::interval
  )
  ON CONFLICT (avatar_id, task_type, task_key) DO NOTHING
  RETURNING true INTO v_lock_acquired;
  
  RETURN COALESCE(v_lock_acquired, false);
END;
$$;

-- 释放任务锁
CREATE OR REPLACE FUNCTION public.release_task_lock(
  p_avatar_id UUID,
  p_task_type TEXT,
  p_task_key TEXT,
  p_locked_by TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.ai_task_locks
  WHERE avatar_id = p_avatar_id
    AND task_type = p_task_type
    AND task_key = p_task_key
    AND locked_by = p_locked_by;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count > 0;
END;
$$;

-- 清理所有过期的锁（定期调用）
CREATE OR REPLACE FUNCTION public.cleanup_expired_task_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.ai_task_locks
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 5. 创建记忆管理函数

-- 搜索相关记忆（基于主题和重要性）
CREATE OR REPLACE FUNCTION public.search_relevant_memories(
  p_avatar_id UUID,
  p_query TEXT,
  p_memory_types TEXT[] DEFAULT ARRAY['fact', 'preference', 'relationship', 'event'],
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  subject TEXT,
  content TEXT,
  importance INTEGER,
  emotional_tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.memory_type,
    m.subject,
    m.content,
    m.importance,
    m.emotional_tag,
    m.created_at,
    m.last_accessed_at,
    m.access_count
  FROM public.ai_avatar_memory m
  WHERE m.avatar_id = p_avatar_id
    AND m.is_active = true
    AND m.memory_type = ANY(p_memory_types)
    AND (
      m.subject ILIKE '%' || p_query || '%'
      OR m.content ILIKE '%' || p_query || '%'
    )
  ORDER BY 
    m.importance DESC,
    m.last_accessed_at DESC
  LIMIT p_limit;
END;
$$;

-- 更新记忆访问统计
CREATE OR REPLACE FUNCTION public.update_memory_access(p_memory_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_avatar_memory
  SET 
    last_accessed_at = now(),
    access_count = access_count + 1
  WHERE id = ANY(p_memory_ids);
END;
$$;

-- 6. 创建自动更新触发器

CREATE OR REPLACE FUNCTION public.update_conversation_context_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_conversation_context_timestamp
BEFORE UPDATE ON public.ai_conversation_context
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_context_timestamp();

-- 7. 启用 RLS（行级安全）

ALTER TABLE public.ai_task_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_avatar_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_context ENABLE ROW LEVEL SECURITY;

-- RLS 策略：只有 AI 分身的所有者可以查看

CREATE POLICY "AI 分身所有者可以查看任务锁"
ON public.ai_task_locks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ai_avatars
    WHERE ai_avatars.id = ai_task_locks.avatar_id
    AND ai_avatars.owner_id = auth.uid()
  )
);

CREATE POLICY "AI 分身所有者可以查看记忆"
ON public.ai_avatar_memory
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ai_avatars
    WHERE ai_avatars.id = ai_avatar_memory.avatar_id
    AND ai_avatars.owner_id = auth.uid()
  )
);

CREATE POLICY "AI 分身所有者可以管理记忆"
ON public.ai_avatar_memory
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.ai_avatars
    WHERE ai_avatars.id = ai_avatar_memory.avatar_id
    AND ai_avatars.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_avatars
    WHERE ai_avatars.id = ai_avatar_memory.avatar_id
    AND ai_avatars.owner_id = auth.uid()
  )
);

CREATE POLICY "AI 分身所有者可以查看会话上下文"
ON public.ai_conversation_context
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ai_avatars
    WHERE ai_avatars.id = ai_conversation_context.avatar_id
    AND ai_avatars.owner_id = auth.uid()
  )
);

-- 系统可以插入锁（用于 Edge Functions）
CREATE POLICY "系统可以管理任务锁"
ON public.ai_task_locks
FOR ALL
USING (true)
WITH CHECK (true);

-- 系统可以管理会话上下文
CREATE POLICY "系统可以管理会话上下文"
ON public.ai_conversation_context
FOR ALL
USING (true)
WITH CHECK (true);