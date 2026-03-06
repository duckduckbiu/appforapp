-- AI Browser Scraper: browser-use + Gemini 视觉提取 + AI 润色
-- 为 aggregated_feed 添加 AI 润色后的内容字段
-- 为 feed_sources 添加 browser_use 源类型支持

-- ═══ aggregated_feed: AI 润色字段 ═══

-- AI 润色后的标题（保留原文事实，换表达避免版权）
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS polished_title TEXT;

-- AI 润色后的正文 HTML
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS polished_content TEXT;

-- AI 处理状态: 'pending' | 'polishing' | 'done' | 'failed' | 'skipped'
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'pending';

-- AI 自动生成的分类（从 feed_categories 中选）
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS ai_category TEXT;

-- AI 生成的一句话摘要（<100 字）
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- AI 润色使用的模型
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- AI 处理时间戳
ALTER TABLE aggregated_feed ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

-- 索引：快速查找待 AI 处理的文章
CREATE INDEX IF NOT EXISTS idx_agg_feed_ai_status
  ON aggregated_feed(ai_status) WHERE ai_status = 'pending';
