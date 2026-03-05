-- Create RLS policies for post-media bucket
-- Allow authenticated users to upload files to post-media bucket
CREATE POLICY "Authenticated users can upload post media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-media');

-- Allow anyone to view post media (public bucket)
CREATE POLICY "Anyone can view post media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'post-media');

-- Allow users to update their own post media
CREATE POLICY "Users can update own post media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own post media
CREATE POLICY "Users can delete own post media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);