-- 修复 AI 分身好友请求功能的 RLS 策略

-- 1. 修改 INSERT 策略：允许用户本人或其 AI 分身发送好友请求
DROP POLICY IF EXISTS "用户可以发送好友请求" ON public.friend_requests;

CREATE POLICY "用户可以发送好友请求" ON public.friend_requests
FOR INSERT
WITH CHECK (
  sender_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = sender_id 
    AND profiles.is_ai_avatar = true 
    AND profiles.owner_id = auth.uid()
  )
);

-- 2. 修改 SELECT 策略：允许查看用户或其 AI 分身相关的请求
DROP POLICY IF EXISTS "用户可以查看发送给自己的好友请求" ON public.friend_requests;

CREATE POLICY "用户可以查看发送给自己的好友请求" ON public.friend_requests
FOR SELECT
USING (
  receiver_id = auth.uid() 
  OR sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE (profiles.id = receiver_id OR profiles.id = sender_id)
    AND profiles.is_ai_avatar = true 
    AND profiles.owner_id = auth.uid()
  )
);

-- 3. 修改 UPDATE 策略：允许用户或其 AI 分身更新接收到的请求
DROP POLICY IF EXISTS "用户可以更新接收到的好友请求" ON public.friend_requests;

CREATE POLICY "用户可以更新接收到的好友请求" ON public.friend_requests
FOR UPDATE
USING (
  receiver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = receiver_id 
    AND profiles.is_ai_avatar = true 
    AND profiles.owner_id = auth.uid()
  )
);

-- 4. 修改 DELETE 策略：允许删除用户或其 AI 分身发送的请求
DROP POLICY IF EXISTS "用户可以删除自己发送的好友请求" ON public.friend_requests;

CREATE POLICY "用户可以删除自己发送的好友请求" ON public.friend_requests
FOR DELETE
USING (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = sender_id 
    AND profiles.is_ai_avatar = true 
    AND profiles.owner_id = auth.uid()
  )
);