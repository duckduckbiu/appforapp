-- ============================================
-- 第一阶段：创建核心基础设施
-- 步骤 1.1 & 1.2：创建统一权限检查函数
-- ============================================

-- 核心函数：检查身份是否属于当前登录用户（真人或其 AI 分身）
CREATE OR REPLACE FUNCTION public.is_owned_identity(identity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    identity_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = identity_id 
        AND is_ai_avatar = true 
        AND owner_id = auth.uid()
    )
$$;

-- 辅助函数：检查当前用户的任一身份是否参与了会话
CREATE OR REPLACE FUNCTION public.is_conversation_participant_v2(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conv_id
      AND is_owned_identity(cp.user_id)
  )
$$;