-- ============================================
-- 1. 创建 avatars bucket（用户头像）
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- ============================================
-- 2. 创建 covers bucket（用户封面）
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'covers', 
  'covers', 
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- ============================================
-- 3. 创建 message-images bucket（聊天图片）
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-images', 
  'message-images', 
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- ============================================
-- 4. 创建 message-files bucket（聊天文件+语音）
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-files', 
  'message-files', 
  true,
  20971520,
  NULL
);

-- ============================================
-- RLS 策略：avatars bucket
-- ============================================
CREATE POLICY "允许认证用户上传头像"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "允许公开访问头像"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "允许用户更新自己的头像"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "允许用户删除自己的头像"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- RLS 策略：covers bucket
-- ============================================
CREATE POLICY "允许认证用户上传封面"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'covers');

CREATE POLICY "允许公开访问封面"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'covers');

CREATE POLICY "允许用户更新自己的封面"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "允许用户删除自己的封面"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- RLS 策略：message-images bucket
-- ============================================
CREATE POLICY "允许认证用户上传聊天图片"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-images');

CREATE POLICY "允许公开访问聊天图片"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'message-images');

CREATE POLICY "允许用户更新自己的聊天图片"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'message-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "允许用户删除自己的聊天图片"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- RLS 策略：message-files bucket
-- ============================================
CREATE POLICY "允许认证用户上传聊天文件"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-files');

CREATE POLICY "允许公开访问聊天文件"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'message-files');

CREATE POLICY "允许用户更新自己的聊天文件"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'message-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "允许用户删除自己的聊天文件"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-files' AND (storage.foldername(name))[1] = auth.uid()::text);