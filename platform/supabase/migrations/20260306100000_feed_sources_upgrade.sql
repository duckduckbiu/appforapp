-- Feed Sources Upgrade: 添加 RSS URL、分类、语言等字段，支持后台管理

-- 新增字段
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS item_count INT DEFAULT 0;
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS error_count INT DEFAULT 0;
ALTER TABLE feed_sources ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 给 aggregated_feed 加分类索引
CREATE INDEX IF NOT EXISTS idx_agg_feed_tags ON aggregated_feed USING GIN(tags);

-- 管理员写入权限（feed_sources）
CREATE POLICY "feed_sources_admin_all" ON feed_sources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 更新现有记录
UPDATE feed_sources SET
  source_url = 'https://hacker-news.firebaseio.com/v0/topstories.json',
  category = 'tech',
  language = 'en',
  description = 'Hacker News 热门故事'
WHERE source_type = 'hackernews' AND name = 'Hacker News Top';

UPDATE feed_sources SET
  source_url = 'https://www.reddit.com/r/technology/hot.json',
  category = 'tech',
  language = 'en'
WHERE source_type = 'reddit' AND config->>'subreddit' = 'technology';

UPDATE feed_sources SET
  source_url = 'https://www.reddit.com/r/programming/hot.json',
  category = 'tech',
  language = 'en'
WHERE source_type = 'reddit' AND config->>'subreddit' = 'programming';

-- 预置 RSS 新闻源（参考 World Monitor + 中文源）
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, description, fetch_interval_minutes) VALUES
  -- 国际新闻（英文）
  ('BBC World News',        'rss', 'https://feeds.bbci.co.uk/news/world/rss.xml',           'news',    'en', '{"limit": 20}', 'BBC 国际新闻',   30),
  ('Reuters World',         'rss', 'https://www.reutersagency.com/feed/',                    'news',    'en', '{"limit": 20}', '路透社新闻',     30),
  ('AP News',               'rss', 'https://rsshub.app/apnews/topics/apf-topnews',          'news',    'en', '{"limit": 20}', '美联社头条',     30),
  ('Al Jazeera English',    'rss', 'https://www.aljazeera.com/xml/rss/all.xml',              'news',    'en', '{"limit": 15}', '半岛电视台',     30),

  -- 科技（英文）
  ('TechCrunch',            'rss', 'https://techcrunch.com/feed/',                           'tech',    'en', '{"limit": 15}', 'TechCrunch 科技新闻', 30),
  ('Ars Technica',          'rss', 'https://feeds.arstechnica.com/arstechnica/index',        'tech',    'en', '{"limit": 15}', 'Ars Technica',   30),
  ('The Verge',             'rss', 'https://www.theverge.com/rss/index.xml',                 'tech',    'en', '{"limit": 15}', 'The Verge',      30),
  ('Wired',                 'rss', 'https://www.wired.com/feed/rss',                         'tech',    'en', '{"limit": 15}', 'Wired 杂志',     60),

  -- 科学
  ('Nature News',           'rss', 'https://www.nature.com/nature.rss',                      'science', 'en', '{"limit": 10}', 'Nature 期刊新闻', 60),
  ('Science Daily',         'rss', 'https://www.sciencedaily.com/rss/all.xml',               'science', 'en', '{"limit": 15}', 'Science Daily',  60),

  -- 财经
  ('CNBC Top News',         'rss', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', 'finance', 'en', '{"limit": 15}', 'CNBC 财经头条', 30),

  -- 中文科技
  ('少数派',                'rss', 'https://sspai.com/feed',                                 'tech',    'zh', '{"limit": 15}', '少数派 — 高效工作，品质生活', 30),
  ('36氪',                  'rss', 'https://rsshub.app/36kr/newsflashes',                    'tech',    'zh', '{"limit": 20}', '36氪快讯',       15),
  ('V2EX 热门',             'rss', 'https://rsshub.app/v2ex/topics/hot',                     'tech',    'zh', '{"limit": 15}', 'V2EX 最热主题',  30),
  ('InfoQ 中文',            'rss', 'https://rsshub.app/infoq/recommend',                     'tech',    'zh', '{"limit": 15}', 'InfoQ 推荐内容', 60),

  -- 中文新闻
  ('澎湃新闻',             'rss', 'https://rsshub.app/thepaper/newsDetail_channel/25950',   'news',    'zh', '{"limit": 20}', '澎湃新闻 — 时事',  30),

  -- Reddit 新闻向
  ('Reddit WorldNews',      'reddit', 'https://www.reddit.com/r/worldnews/hot.json',        'news',    'en', '{"subreddit": "worldnews", "sort": "hot", "limit": 20}', 'Reddit 国际新闻', 30),
  ('Reddit Science',        'reddit', 'https://www.reddit.com/r/science/hot.json',           'science', 'en', '{"subreddit": "science", "sort": "hot", "limit": 15}',   'Reddit 科学',    30)

ON CONFLICT DO NOTHING;
