-- VM Management Tables

-- VM 实例表
CREATE TABLE IF NOT EXISTS public.vm_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, -- 'aws', 'gcp', 'digitalocean'
  instance_id TEXT NOT NULL, -- 云提供商的实例 ID
  ip_address TEXT NOT NULL,
  webrtc_url TEXT,
  status TEXT NOT NULL DEFAULT 'initializing', -- 'initializing', 'ready', 'busy', 'error', 'terminating'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- VM 任务分配表
CREATE TABLE IF NOT EXISTS public.vm_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vm_id UUID NOT NULL REFERENCES public.vm_instances(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.visual_agent_tasks(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  UNIQUE(task_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_vm_instances_status ON public.vm_instances(status);
CREATE INDEX IF NOT EXISTS idx_vm_instances_last_heartbeat ON public.vm_instances(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_vm_assignments_vm_id ON public.vm_assignments(vm_id);
CREATE INDEX IF NOT EXISTS idx_vm_assignments_task_id ON public.vm_assignments(task_id);

-- RLS 策略
ALTER TABLE public.vm_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vm_assignments ENABLE ROW LEVEL SECURITY;

-- 管理员可以管理 VM
CREATE POLICY "Admins can manage VMs"
ON public.vm_instances
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage VM assignments"
ON public.vm_assignments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 系统可以管理 VM（用于 Edge Functions）
CREATE POLICY "System can manage VMs"
ON public.vm_instances
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "System can manage VM assignments"
ON public.vm_assignments
FOR ALL
USING (true)
WITH CHECK (true);