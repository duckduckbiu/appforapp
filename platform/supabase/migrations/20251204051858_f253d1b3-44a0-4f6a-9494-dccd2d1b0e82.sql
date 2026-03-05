-- Add columns for dual-image storage (original + masked)
ALTER TABLE post_media 
ADD COLUMN IF NOT EXISTS original_media_url text,
ADD COLUMN IF NOT EXISTS masked_media_url text;

-- Create protected storage bucket for original images
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media-protected', 'post-media-protected', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Only allow authenticated users to upload to protected bucket
CREATE POLICY "Authenticated users can upload protected media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-media-protected');

-- RLS policy: Only service role can read from protected bucket (via Edge Function)
CREATE POLICY "Service role can read protected media"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'post-media-protected');

-- RLS policy: Authors can delete their protected media
CREATE POLICY "Users can delete own protected media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-media-protected' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);