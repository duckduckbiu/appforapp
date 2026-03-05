-- 修复 messages 表的 INSERT 策略，允许 AI 分身发送消息

DROP POLICY IF EXISTS "用户可以发送消息" ON public.messages;

CREATE POLICY "用户可以发送消息" ON public.messages
FOR INSERT
WITH CHECK (
  -- 允许真人用户或其 AI 分身发送消息
  (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = sender_id 
      AND profiles.is_ai_avatar = true 
      AND profiles.owner_id = auth.uid()
    )
  )
  -- 必须是会话参与者
  AND (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
        AND conversation_participants.user_id = sender_id
    )
  )
  -- 不能给屏蔽自己的用户发消息
  AND (
    NOT EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id != sender_id
        AND is_blocked(sender_id, cp.user_id) = true
    )
  )
);