-- ============================================
-- 第三阶段：修复消息相关表 RLS 策略
-- 步骤 3.1-3.4：使用统一权限检查函数
-- ============================================

-- 3.1: 修复 messages 表 SELECT 策略
DROP POLICY IF EXISTS "用户可以查看参与会话的消息" ON public.messages;

CREATE POLICY "用户可以查看参与会话的消息" ON public.messages
FOR SELECT
USING (
  is_conversation_participant_v2(conversation_id)
  AND NOT EXISTS (
    SELECT 1 FROM message_deletions
    WHERE message_deletions.message_id = messages.id
      AND is_owned_identity(message_deletions.user_id)
  )
);

-- 3.2: 修复 messages 表 UPDATE 策略（删除消息）
DROP POLICY IF EXISTS "发送者可以删除自己的消息" ON public.messages;

CREATE POLICY "发送者可以删除自己的消息" ON public.messages
FOR UPDATE
USING (
  is_owned_identity(sender_id)
);

-- 3.3: 修复 message_deletions 表 INSERT 策略
DROP POLICY IF EXISTS "用户可以删除消息" ON public.message_deletions;

CREATE POLICY "用户可以删除消息" ON public.message_deletions
FOR INSERT
WITH CHECK (
  is_owned_identity(user_id)
);

-- 3.4: 修复 message_deletions 表 SELECT 策略
DROP POLICY IF EXISTS "用户可以查看自己的删除记录" ON public.message_deletions;

CREATE POLICY "用户可以查看自己的删除记录" ON public.message_deletions
FOR SELECT
USING (
  is_owned_identity(user_id)
);