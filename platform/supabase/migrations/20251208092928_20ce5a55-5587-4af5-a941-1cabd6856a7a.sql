-- 创建社交通知表
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'comment', 'like', 'follow'
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  content TEXT, -- 预览内容
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的通知
CREATE POLICY "用户可以查看自己的通知"
ON public.notifications
FOR SELECT
USING (is_owned_identity(user_id));

-- 系统可以创建通知
CREATE POLICY "系统可以创建通知"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- 用户可以更新自己的通知（标记已读）
CREATE POLICY "用户可以更新自己的通知"
ON public.notifications
FOR UPDATE
USING (is_owned_identity(user_id));

-- 用户可以删除自己的通知
CREATE POLICY "用户可以删除自己的通知"
ON public.notifications
FOR DELETE
USING (is_owned_identity(user_id));

-- 创建索引
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);

-- 创建触发器函数：评论时通知帖子作者
CREATE OR REPLACE FUNCTION public.notify_post_author_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id UUID;
  v_comment_preview TEXT;
BEGIN
  -- 获取帖子作者
  SELECT author_id INTO v_post_author_id FROM posts WHERE id = NEW.post_id;
  
  -- 不通知自己评论自己的帖子
  IF v_post_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;
  
  -- 截取评论预览
  v_comment_preview := LEFT(NEW.content, 100);
  
  -- 创建通知
  INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id, content)
  VALUES (v_post_author_id, 'comment', NEW.author_id, NEW.post_id, NEW.id, v_comment_preview);
  
  RETURN NEW;
END;
$$;

-- 创建触发器：评论时触发通知
CREATE TRIGGER on_comment_notify_author
AFTER INSERT ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_post_author_on_comment();

-- 创建触发器函数：点赞时通知帖子作者
CREATE OR REPLACE FUNCTION public.notify_post_author_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id UUID;
BEGIN
  -- 获取帖子作者
  SELECT author_id INTO v_post_author_id FROM posts WHERE id = NEW.post_id;
  
  -- 不通知自己点赞自己的帖子
  IF v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- 创建通知
  INSERT INTO notifications (user_id, type, actor_id, post_id)
  VALUES (v_post_author_id, 'like', NEW.user_id, NEW.post_id);
  
  RETURN NEW;
END;
$$;

-- 创建触发器：点赞时触发通知
CREATE TRIGGER on_like_notify_author
AFTER INSERT ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_post_author_on_like();

-- 创建触发器函数：关注时通知被关注者
CREATE OR REPLACE FUNCTION public.notify_user_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 创建通知
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);
  
  RETURN NEW;
END;
$$;

-- 创建触发器：关注时触发通知
CREATE TRIGGER on_follow_notify_user
AFTER INSERT ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_on_follow();

-- 启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;