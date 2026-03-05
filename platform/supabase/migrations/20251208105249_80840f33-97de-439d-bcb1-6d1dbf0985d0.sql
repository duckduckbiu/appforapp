-- 改进 delete_conversation_for_all 函数，同时删除会话记录避免孤立数据
CREATE OR REPLACE FUNCTION public.delete_conversation_for_all(p_conversation_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- 验证用户是会话参与者
  IF NOT EXISTS (
    SELECT 1 
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id 
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION '用户不是该会话的参与者';
  END IF;
  
  -- 将会话中的所有消息标记为已删除
  UPDATE public.messages
  SET is_deleted = true
  WHERE conversation_id = p_conversation_id;
  
  -- 删除最后消息缓存
  DELETE FROM public.last_message_cache
  WHERE conversation_id = p_conversation_id;
  
  -- 删除会话的所有参与者记录
  DELETE FROM public.conversation_participants
  WHERE conversation_id = p_conversation_id;
  
  -- 删除群聊信息（如果有）
  DELETE FROM public.group_chats
  WHERE conversation_id = p_conversation_id;
  
  -- 删除会话记录本身，防止孤立数据
  DELETE FROM public.conversations
  WHERE id = p_conversation_id;
END;
$function$;