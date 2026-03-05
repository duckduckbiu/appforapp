-- 修复 create_private_conversation 函数，支持 AI 分身创建会话

CREATE OR REPLACE FUNCTION public.create_private_conversation(
  friend_uuid uuid,
  sender_uuid uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_conversation_id UUID;
  v_existing_conversation_id UUID;
BEGIN
  -- 确定发起者 ID：如果提供了 sender_uuid 则使用它，否则使用 auth.uid()
  v_user_id := COALESCE(sender_uuid, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '用户未登录';
  END IF;
  
  -- 如果 sender_uuid 是 AI 分身，验证其属于当前登录用户
  IF sender_uuid IS NOT NULL AND sender_uuid != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = sender_uuid 
      AND is_ai_avatar = true 
      AND owner_id = auth.uid()
    ) THEN
      RAISE EXCEPTION '无权使用此身份';
    END IF;
  END IF;
  
  -- 检查好友关系是否存在
  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE user_id = v_user_id AND friend_id = friend_uuid
  ) THEN
    RAISE EXCEPTION '非好友关系，无法创建会话';
  END IF;
  
  -- 首先检查是否存在隐藏的会话
  SELECT cp1.conversation_id INTO v_existing_conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = v_user_id 
    AND cp2.user_id = friend_uuid
    AND c.type = 'private'
    AND cp1.is_hidden = true;
  
  -- 如果找到隐藏的会话，恢复显示
  IF v_existing_conversation_id IS NOT NULL THEN
    UPDATE conversation_participants
    SET is_hidden = false
    WHERE conversation_id = v_existing_conversation_id 
      AND user_id = v_user_id;
    RETURN v_existing_conversation_id;
  END IF;
  
  -- 检查是否已存在非隐藏的私聊会话
  SELECT cp1.conversation_id INTO v_existing_conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = v_user_id 
    AND cp2.user_id = friend_uuid
    AND c.type = 'private';
  
  IF v_existing_conversation_id IS NOT NULL THEN
    RETURN v_existing_conversation_id;
  END IF;
  
  -- 创建新会话
  INSERT INTO conversations (type)
  VALUES ('private')
  RETURNING id INTO v_conversation_id;
  
  -- 添加两个参与者
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id);
  
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, friend_uuid);
  
  RETURN v_conversation_id;
END;
$function$;