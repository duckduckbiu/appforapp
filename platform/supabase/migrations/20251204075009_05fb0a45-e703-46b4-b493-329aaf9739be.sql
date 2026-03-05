-- 删除现有的 UPDATE 策略
DROP POLICY IF EXISTS "用户可以更新自己的帖子" ON posts;

-- 重新创建 UPDATE 策略，添加 WITH CHECK 子句
CREATE POLICY "用户可以更新自己的帖子" 
ON posts 
FOR UPDATE 
USING (is_owned_identity(author_id))
WITH CHECK (is_owned_identity(author_id));