-- 创建 Visual Agent 任务表
CREATE TABLE IF NOT EXISTS public.visual_agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 任务信息
  user_input TEXT NOT NULL,
  target_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'aborted')),
  
  -- VM 配置
  vm_config JSONB DEFAULT '{}'::jsonb,
  
  -- 运行信息
  stream_url TEXT,
  current_url TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- 结果
  result JSONB,
  error TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建活动日志表
CREATE TABLE IF NOT EXISTS public.visual_agent_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.visual_agent_tasks(id) ON DELETE CASCADE,
  
  -- 日志内容
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  type TEXT NOT NULL CHECK (type IN ('info', 'action', 'thought', 'error', 'screenshot')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_visual_agent_tasks_user_id ON public.visual_agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_visual_agent_tasks_status ON public.visual_agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_visual_agent_tasks_created_at ON public.visual_agent_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visual_agent_activity_logs_task_id ON public.visual_agent_activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_visual_agent_activity_logs_timestamp ON public.visual_agent_activity_logs(timestamp DESC);

-- 启用 RLS
ALTER TABLE public.visual_agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_agent_activity_logs ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能查看自己的任务
CREATE POLICY "用户可以查看自己的任务"
  ON public.visual_agent_tasks
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "用户可以创建自己的任务"
  ON public.visual_agent_tasks
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户可以更新自己的任务"
  ON public.visual_agent_tasks
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "用户可以删除自己的任务"
  ON public.visual_agent_tasks
  FOR DELETE
  USING (user_id = auth.uid());

-- 活动日志策略：用户可以查看自己任务的日志
CREATE POLICY "用户可以查看自己任务的日志"
  ON public.visual_agent_activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.visual_agent_tasks
      WHERE visual_agent_tasks.id = visual_agent_activity_logs.task_id
        AND visual_agent_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "系统可以插入活动日志"
  ON public.visual_agent_activity_logs
  FOR INSERT
  WITH CHECK (true);

-- 创建更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_visual_agent_task_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_visual_agent_tasks_updated_at
  BEFORE UPDATE ON public.visual_agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_visual_agent_task_timestamp();