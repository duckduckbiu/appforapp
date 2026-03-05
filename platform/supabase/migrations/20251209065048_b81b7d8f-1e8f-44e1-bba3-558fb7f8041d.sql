-- Create post_drafts table for saving draft posts
CREATE TABLE public.post_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  visibility TEXT DEFAULT 'public',
  media_data JSONB DEFAULT '[]',
  unlock_settings JSONB,
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own drafts"
ON public.post_drafts
FOR SELECT
USING (is_owned_identity(user_id));

CREATE POLICY "Users can create their own drafts"
ON public.post_drafts
FOR INSERT
WITH CHECK (is_owned_identity(user_id));

CREATE POLICY "Users can update their own drafts"
ON public.post_drafts
FOR UPDATE
USING (is_owned_identity(user_id))
WITH CHECK (is_owned_identity(user_id));

CREATE POLICY "Users can delete their own drafts"
ON public.post_drafts
FOR DELETE
USING (is_owned_identity(user_id));

-- Create trigger for updating updated_at
CREATE TRIGGER update_post_drafts_updated_at
BEFORE UPDATE ON public.post_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();