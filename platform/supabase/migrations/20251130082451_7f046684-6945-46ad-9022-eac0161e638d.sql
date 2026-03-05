-- 修复 accept_friend_request 函数，允许 AI 分身接受好友请求

CREATE OR REPLACE FUNCTION public.accept_friend_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_status TEXT;
BEGIN
  -- 获取好友请求信息
  SELECT sender_id, receiver_id, status
  INTO v_sender_id, v_receiver_id, v_status
  FROM friend_requests
  WHERE id = request_id;
  
  -- 检查请求是否存在
  IF NOT FOUND THEN
    RAISE EXCEPTION '好友请求不存在';
  END IF;
  
  -- 检查当前用户是否是接收者（本人或其 AI 分身）
  IF v_receiver_id != auth.uid() 
     AND NOT EXISTS (
       SELECT 1 FROM profiles 
       WHERE profiles.id = v_receiver_id 
       AND profiles.is_ai_avatar = true 
       AND profiles.owner_id = auth.uid()
     ) THEN
    RAISE EXCEPTION '无权接受此好友请求';
  END IF;
  
  -- 检查请求状态
  IF v_status != 'pending' THEN
    RAISE EXCEPTION '好友请求已处理';
  END IF;
  
  -- 更新请求状态
  UPDATE friend_requests
  SET status = 'accepted'
  WHERE id = request_id;
  
  -- 创建双向好友关系（使用 SECURITY DEFINER 绕过 RLS）
  INSERT INTO friendships (user_id, friend_id)
  VALUES (v_receiver_id, v_sender_id)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO friendships (user_id, friend_id)
  VALUES (v_sender_id, v_receiver_id)
  ON CONFLICT DO NOTHING;
END;
$function$;