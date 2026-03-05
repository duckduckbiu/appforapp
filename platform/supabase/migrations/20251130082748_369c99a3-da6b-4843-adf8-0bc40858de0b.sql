-- 修复 friendships 表的 RLS 策略，允许查看 AI 分身的好友关系

-- 1. 修改 SELECT 策略
DROP POLICY IF EXISTS "用户可以查看自己的好友关系" ON public.friendships;

CREATE POLICY "用户可以查看自己的好友关系" ON public.friendships
FOR SELECT
USING (
  user_id = auth.uid() 
  OR friend_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE (profiles.id = user_id OR profiles.id = friend_id)
    AND profiles.is_ai_avatar = true 
    AND profiles.owner_id = auth.uid()
  )
);

-- 2. 修改 INSERT 策略
DROP POLICY IF EXISTS "用户可以添加好友关系" ON public.friendships;

CREATE POLICY "用户可以添加好友关系" ON public.friendships
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_id 
    AND profiles.is_ai_avatar = true 
    AND profiles.owner_id = auth.uid()
  )
);

-- 3. 修改 UPDATE 策略
DROP POLICY IF EXISTS "用户可以更新自己的好友关系" ON public.friendships;

CREATE POLICY "用户可以更新自己的好友关系" ON public.friendships
FOR UPDATE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_id 
    AND profiles.is_ai_avatar = true 
    AND profiles.owner_id = auth.uid()
  )
);

-- 4. 修改 DELETE 策略
DROP POLICY IF EXISTS "用户可以删除自己的好友关系" ON public.friendships;

CREATE POLICY "用户可以删除自己的好友关系" ON public.friendships
FOR DELETE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_id 
    AND profiles.is_ai_avatar = true 
    AND profiles.owner_id = auth.uid()
  )
);