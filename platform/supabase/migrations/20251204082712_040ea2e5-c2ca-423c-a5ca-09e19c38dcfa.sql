-- 删除现有的 UPDATE 策略（如果存在）
DROP POLICY IF EXISTS "用户可以更新自己的帖子" ON public.posts;

-- 重新创建 PERMISSIVE 的 UPDATE 策略
CREATE POLICY "用户可以更新自己的帖子" 
ON public.posts 
FOR UPDATE 
TO authenticated
USING (is_owned_identity(author_id))
WITH CHECK (is_owned_identity(author_id));