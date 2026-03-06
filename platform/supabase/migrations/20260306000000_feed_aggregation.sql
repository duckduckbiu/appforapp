-- Feed Aggregation: 外部内容聚合（冷启动）

CREATE TABLE IF NOT EXISTS aggregated_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT,
  content TEXT,
  url TEXT,
  image_url TEXT,
  author_name TEXT,
  author_avatar TEXT,
  score INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  language TEXT DEFAULT 'en',
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source, source_id)
);

CREATE INDEX idx_agg_feed_published ON aggregated_feed(published_at DESC);
CREATE INDEX idx_agg_feed_source ON aggregated_feed(source, fetched_at DESC);

CREATE TABLE IF NOT EXISTS feed_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  fetch_interval_minutes INT DEFAULT 30,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO feed_sources (name, source_type, config) VALUES
  ('Hacker News Top', 'hackernews', '{"endpoint": "topstories", "limit": 30}'),
  ('Reddit r/technology', 'reddit', '{"subreddit": "technology", "sort": "hot", "limit": 25}'),
  ('Reddit r/programming', 'reddit', '{"subreddit": "programming", "sort": "hot", "limit": 25}');

ALTER TABLE aggregated_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aggregated_feed_public_read" ON aggregated_feed FOR SELECT USING (true);

ALTER TABLE feed_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_sources_public_read" ON feed_sources FOR SELECT USING (true);
