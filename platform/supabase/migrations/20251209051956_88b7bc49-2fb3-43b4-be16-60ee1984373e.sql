-- Create hashtags table
CREATE TABLE public.hashtags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  post_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create post_hashtags junction table
CREATE TABLE public.post_hashtags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, hashtag_id)
);

-- Enable RLS
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

-- Hashtags policies - everyone can read
CREATE POLICY "Everyone can view hashtags"
  ON public.hashtags
  FOR SELECT
  USING (true);

-- Post_hashtags policies
CREATE POLICY "Everyone can view post hashtags"
  ON public.post_hashtags
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create post hashtags for their posts"
  ON public.post_hashtags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_hashtags.post_id
      AND is_owned_identity(posts.author_id)
    )
  );

CREATE POLICY "Users can delete post hashtags for their posts"
  ON public.post_hashtags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_hashtags.post_id
      AND is_owned_identity(posts.author_id)
    )
  );

-- Function to update hashtag post_count
CREATE OR REPLACE FUNCTION update_hashtag_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.hashtags
    SET post_count = post_count + 1, updated_at = now()
    WHERE id = NEW.hashtag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.hashtags
    SET post_count = GREATEST(0, post_count - 1), updated_at = now()
    WHERE id = OLD.hashtag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for post_count updates
CREATE TRIGGER update_hashtag_count
AFTER INSERT OR DELETE ON public.post_hashtags
FOR EACH ROW
EXECUTE FUNCTION update_hashtag_post_count();

-- Function to get or create hashtag
CREATE OR REPLACE FUNCTION get_or_create_hashtag(tag_name TEXT)
RETURNS UUID AS $$
DECLARE
  hashtag_id UUID;
BEGIN
  -- Try to find existing hashtag
  SELECT id INTO hashtag_id
  FROM public.hashtags
  WHERE name = lower(trim(tag_name));
  
  -- If not found, create it
  IF hashtag_id IS NULL THEN
    INSERT INTO public.hashtags (name)
    VALUES (lower(trim(tag_name)))
    RETURNING id INTO hashtag_id;
  END IF;
  
  RETURN hashtag_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create index for hashtag search
CREATE INDEX idx_hashtags_name ON public.hashtags USING gin(name gin_trgm_ops);
CREATE INDEX idx_post_hashtags_post_id ON public.post_hashtags(post_id);
CREATE INDEX idx_post_hashtags_hashtag_id ON public.post_hashtags(hashtag_id);