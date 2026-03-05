-- ============================================
-- 第四阶段：修复群聊相关表 RLS 策略
-- 步骤 4.1-4.6：使用统一权限检查函数
-- ============================================

-- 4.1: 修复 group_chats 表 INSERT 策略
DROP POLICY IF EXISTS "用户可以创建群聊" ON public.group_chats;

CREATE POLICY "用户可以创建群聊" ON public.group_chats
FOR INSERT
WITH CHECK (
  is_owned_identity(creator_id)
);

-- 4.2: 修复 group_chats 表 SELECT 策略
DROP POLICY IF EXISTS "群成员可以查看群聊信息_v2" ON public.group_chats;

CREATE POLICY "群成员可以查看群聊信息_v2" ON public.group_chats
FOR SELECT
USING (
  is_conversation_participant_v2(conversation_id)
);

-- 4.3: 修复 group_chats 表 UPDATE 策略
DROP POLICY IF EXISTS "群管理员可以更新群聊信息_v2" ON public.group_chats;

CREATE POLICY "群管理员可以更新群聊信息_v2" ON public.group_chats
FOR UPDATE
USING (
  is_owned_identity(creator_id)
);

-- 4.4: 修复 group_members 表 SELECT 策略
DROP POLICY IF EXISTS "群成员可以查看群成员列表_v2" ON public.group_members;

CREATE POLICY "群成员可以查看群成员列表_v2" ON public.group_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_chats gc
    JOIN conversation_participants cp ON cp.conversation_id = gc.conversation_id
    WHERE gc.id = group_members.group_id
      AND is_owned_identity(cp.user_id)
  )
);

-- 4.5: 修复 group_members 表 INSERT 策略
DROP POLICY IF EXISTS "群管理员可以添加群成员_v2" ON public.group_members;

CREATE POLICY "群管理员可以添加群成员_v2" ON public.group_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_chats gc
    JOIN conversation_participants cp ON cp.conversation_id = gc.conversation_id
    WHERE gc.id = group_members.group_id
      AND is_owned_identity(cp.user_id)
  )
  OR NOT EXISTS (
    SELECT 1 FROM group_chats gc
    WHERE gc.id = group_members.group_id
  )
);

-- 4.6: 修复 group_members 表 DELETE 策略
DROP POLICY IF EXISTS "群成员可以退出群聊" ON public.group_members;

CREATE POLICY "群成员可以退出群聊" ON public.group_members
FOR DELETE
USING (
  is_owned_identity(user_id)
);