-- 1. 定时发布功能：添加 scheduled_at 字段到 posts 表
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 添加索引用于查询定时帖子
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON public.posts (scheduled_at) WHERE scheduled_at IS NOT NULL;

-- 2. 举报功能：创建 reports 表
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL, -- 'post', 'comment', 'user', 'message'
  target_id UUID NOT NULL,
  reason TEXT NOT NULL, -- 'spam', 'harassment', 'inappropriate', 'violence', 'copyright', 'other'
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 用户可以创建举报
CREATE POLICY "用户可以创建举报" ON public.reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- 用户可以查看自己的举报
CREATE POLICY "用户可以查看自己的举报" ON public.reports
  FOR SELECT USING (reporter_id = auth.uid());

-- 管理员可以查看所有举报
CREATE POLICY "管理员可以查看所有举报" ON public.reports
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- 管理员可以更新举报状态
CREATE POLICY "管理员可以更新举报状态" ON public.reports
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- 3. 陌生人私信功能：创建消息请求表
CREATE TABLE IF NOT EXISTS public.message_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- 启用 RLS
ALTER TABLE public.message_requests ENABLE ROW LEVEL SECURITY;

-- 用户可以发送消息请求
CREATE POLICY "用户可以发送消息请求" ON public.message_requests
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- 用户可以查看发给自己的消息请求
CREATE POLICY "用户可以查看消息请求" ON public.message_requests
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- 接收者可以更新消息请求状态
CREATE POLICY "接收者可以更新消息请求状态" ON public.message_requests
  FOR UPDATE USING (receiver_id = auth.uid());

-- 发送者可以删除自己的消息请求
CREATE POLICY "发送者可以删除消息请求" ON public.message_requests
  FOR DELETE USING (sender_id = auth.uid());

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION update_reports_updated_at();

CREATE TRIGGER update_message_requests_updated_at
  BEFORE UPDATE ON public.message_requests
  FOR EACH ROW EXECUTE FUNCTION update_reports_updated_at();