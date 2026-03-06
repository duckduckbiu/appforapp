-- Fix broken RSS feed source URLs

-- Reuters: use RSS feed directly
UPDATE feed_sources SET source_url = 'https://feeds.reuters.com/reuters/topNews'
WHERE name = 'Reuters World' AND source_type = 'rss';

-- AP News: use direct RSS instead of RSSHub
UPDATE feed_sources SET source_url = 'https://feedx.net/rss/ap.xml'
WHERE name = 'AP News' AND source_type = 'rss';

-- 澎湃: use direct RSS instead of RSSHub
UPDATE feed_sources SET source_url = 'https://feedx.net/rss/thepaper.xml'
WHERE name = '澎湃新闻' AND source_type = 'rss';

-- 36氪: use direct RSS instead of RSSHub
UPDATE feed_sources SET source_url = 'https://feedx.net/rss/36kr.xml'
WHERE name = '36氪' AND source_type = 'rss';

-- V2EX: use native RSS
UPDATE feed_sources SET source_url = 'https://www.v2ex.com/index.xml'
WHERE name = 'V2EX' AND source_type = 'rss';

-- InfoQ: use feedx mirror
UPDATE feed_sources SET source_url = 'https://feedx.net/rss/infoq-cn.xml'
WHERE name = 'InfoQ CN' AND source_type = 'rss';
