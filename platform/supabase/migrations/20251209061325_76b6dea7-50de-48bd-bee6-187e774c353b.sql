-- 创建函数：从内容中提取被提及的用户并创建通知
CREATE OR REPLACE FUNCTION public.create_mention_notifications(
  p_actor_id UUID,
  p_content TEXT,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mention_username TEXT;
  mentioned_user_id UUID;
  mention_pattern TEXT := '@([a-zA-Z0-9_]+)';
  mentions TEXT[];
BEGIN
  -- 提取所有 @username
  SELECT ARRAY(
    SELECT DISTINCT (regexp_matches(p_content, mention_pattern, 'g'))[1]
  ) INTO mentions;
  
  -- 为每个被提及的用户创建通知
  FOREACH mention_username IN ARRAY mentions
  LOOP
    -- 查找用户 ID
    SELECT id INTO mentioned_user_id
    FROM profiles
    WHERE unique_username = mention_username
    LIMIT 1;
    
    -- 如果用户存在且不是自己
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != p_actor_id THEN
      -- 创建通知
      INSERT INTO notifications (
        user_id,
        type,
        actor_id,
        post_id,
        comment_id,
        content
      ) VALUES (
        mentioned_user_id,
        'mention',
        p_actor_id,
        p_post_id,
        p_comment_id,
        LEFT(p_content, 100)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 创建触发器：在帖子创建时检测 @提及
CREATE OR REPLACE FUNCTION public.notify_on_post_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 检测帖子内容中的 @提及
  IF NEW.content IS NOT NULL AND NEW.content ~ '@[a-zA-Z0-9_]+' THEN
    PERFORM create_mention_notifications(
      NEW.author_id,
      NEW.content,
      NEW.id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 创建触发器：在评论创建时检测 @提及
CREATE OR REPLACE FUNCTION public.notify_on_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_post_id UUID;
BEGIN
  -- 获取帖子 ID
  v_post_id := NEW.post_id;
  
  -- 检测评论内容中的 @提及
  IF NEW.content IS NOT NULL AND NEW.content ~ '@[a-zA-Z0-9_]+' THEN
    PERFORM create_mention_notifications(
      NEW.author_id,
      NEW.content,
      v_post_id,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 绑定触发器到帖子表
DROP TRIGGER IF EXISTS on_post_mention ON posts;
CREATE TRIGGER on_post_mention
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_post_mention();

-- 绑定触发器到评论表
DROP TRIGGER IF EXISTS on_comment_mention ON post_comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_comment_mention();