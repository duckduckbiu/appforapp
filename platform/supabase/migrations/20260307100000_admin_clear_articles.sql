-- Admin function to clear all articles (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION admin_clear_all_articles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check admin role
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  -- Delete all articles
  DELETE FROM aggregated_feed;
END;
$$;
