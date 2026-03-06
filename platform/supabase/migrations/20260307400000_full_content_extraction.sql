-- Full Content Extraction: 全文抓取 + 图片本地化 (Strategy B)
-- 为 RSS 文章添加全文内容、图片/视频 JSON、提取状态等字段

-- ═══ aggregated_feed 新增列 ═══

ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS full_content TEXT;

ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS full_content_status TEXT DEFAULT 'pending';
  -- 'pending' | 'fetched' | 'failed' | 'skipped'

ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
  -- [{url, storage_path, alt, width, height}]

ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]';
  -- [{url, type, thumbnail}]  type: youtube/vimeo/mp4/embed

ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS word_count INT;

ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS extraction_error TEXT;

ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

-- 部分索引：快速查找待提取的文章
CREATE INDEX IF NOT EXISTS idx_agg_feed_extraction_status
  ON aggregated_feed(full_content_status) WHERE full_content_status = 'pending';

-- ═══ feed_media 表：追踪已下载的图片 ═══

CREATE TABLE IF NOT EXISTS feed_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES aggregated_feed(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  width INT,
  height INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_media_article ON feed_media(article_id);

ALTER TABLE feed_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_media_public_read" ON feed_media FOR SELECT USING (true);

-- ═══ Storage bucket: feed-media ═══

INSERT INTO storage.buckets (id, name, public)
VALUES ('feed-media', 'feed-media', true)
ON CONFLICT DO NOTHING;

-- Storage policies: 公开读，service_role 写/删
CREATE POLICY "feed_media_storage_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'feed-media');

CREATE POLICY "feed_media_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'feed-media');

CREATE POLICY "feed_media_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'feed-media');
