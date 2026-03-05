-- 添加 UPDATE RLS 策略，允许用户更新自己的删除记录
-- 这样 upsert 操作在遇到冲突时可以正常执行 UPDATE
CREATE POLICY "用户可以更新自己的删除记录"
ON public.message_deletions
FOR UPDATE
USING (is_owned_identity(user_id))
WITH CHECK (is_owned_identity(user_id));