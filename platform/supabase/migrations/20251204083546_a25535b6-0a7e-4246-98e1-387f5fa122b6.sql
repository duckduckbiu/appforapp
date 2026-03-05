-- 删除现有的 SELECT 策略
DROP POLICY IF EXISTS "用户可以查看公开帖子" ON public.posts;

-- 创建新策略：作者可以看到自己所有帖子，其他人只能看到未删除的帖子
CREATE POLICY "用户可以查看帖子" 
ON public.posts 
FOR SELECT 
TO public
USING (
  is_owned_identity(author_id)  -- 作者始终可以看到自己的帖子（包括已删除的）
  OR (
    is_deleted = false AND (  -- 非作者只能看到未删除的帖子
      visibility = 'public'
      OR (visibility = 'followers' AND EXISTS (
        SELECT 1 FROM follows
        WHERE follows.follower_id = auth.uid() 
        AND follows.following_id = posts.author_id
      ))
      OR (visibility = 'friends' AND EXISTS (
        SELECT 1 FROM friendships
        WHERE friendships.user_id = auth.uid() 
        AND friendships.friend_id = posts.author_id
      ))
    )
  )
);