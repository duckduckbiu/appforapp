-- ============================================
-- 第二阶段：修复会话相关表 RLS 策略
-- 步骤 2.1-2.5：使用统一权限检查函数
-- ============================================

-- 2.1: 修复 conversation_participants 表 INSERT 策略
DROP POLICY IF EXISTS "用户可以加入会话" ON public.conversation_participants;

CREATE POLICY "用户可以加入会话" ON public.conversation_participants
FOR INSERT
WITH CHECK (
  is_owned_identity(user_id)
);

-- 2.2: 修复 conversation_participants 表 UPDATE 策略
DROP POLICY IF EXISTS "用户可以更新自己的会话状态" ON public.conversation_participants;

CREATE POLICY "用户可以更新自己的会话状态" ON public.conversation_participants
FOR UPDATE
USING (
  is_owned_identity(user_id)
);

-- 2.3: 修复 conversation_participants 表 SELECT 策略
DROP POLICY IF EXISTS "用户可以查看参与的会话成员" ON public.conversation_participants;

CREATE POLICY "用户可以查看参与的会话成员" ON public.conversation_participants
FOR SELECT
USING (
  is_conversation_participant_v2(conversation_id)
);

-- 2.4: 修复 conversation_participants 表 DELETE 策略
DROP POLICY IF EXISTS "用户可以退出会话" ON public.conversation_participants;

CREATE POLICY "用户可以退出会话" ON public.conversation_participants
FOR DELETE
USING (
  is_owned_identity(user_id)
);

-- 2.5: 修复 conversations 表 SELECT 策略
DROP POLICY IF EXISTS "用户可以查看参与的会话" ON public.conversations;

CREATE POLICY "用户可以查看参与的会话" ON public.conversations
FOR SELECT
USING (
  is_conversation_participant_v2(id)
);