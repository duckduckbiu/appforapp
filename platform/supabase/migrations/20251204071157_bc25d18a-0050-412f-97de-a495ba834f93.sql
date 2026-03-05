-- Add UPDATE policy for post_likes table to allow users to update their own likes
CREATE POLICY "用户可以更新自己的点赞" 
ON public.post_likes 
FOR UPDATE 
TO authenticated 
USING (is_owned_identity(user_id))
WITH CHECK (is_owned_identity(user_id));