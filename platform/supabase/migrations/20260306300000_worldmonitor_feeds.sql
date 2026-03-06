-- Batch import curated feeds from World Monitor (420+ sources)
-- Selecting most reliable direct RSS feeds across key categories

-- ═══ World News ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('Guardian World', 'rss', 'https://www.theguardian.com/world/rss', 'news', 'en', '{"limit": 20}', true),
('NPR News', 'rss', 'https://feeds.npr.org/1001/rss.xml', 'news', 'en', '{"limit": 20}', true),
('PBS NewsHour', 'rss', 'https://www.pbs.org/newshour/feeds/rss/headlines', 'news', 'en', '{"limit": 15}', true),
('ABC News', 'rss', 'https://feeds.abcnews.com/abcnews/topstories', 'news', 'en', '{"limit": 15}', true),
('France 24', 'rss', 'https://www.france24.com/en/rss', 'news', 'en', '{"limit": 15}', true),
('DW News', 'rss', 'https://rss.dw.com/xml/rss-en-all', 'news', 'en', '{"limit": 15}', true),
('UN News', 'rss', 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', 'news', 'en', '{"limit": 15}', true)
ON CONFLICT DO NOTHING;

-- ═══ Regional: Asia ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('BBC Asia', 'rss', 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', 'news', 'en', '{"limit": 15}', true),
('SCMP', 'rss', 'https://www.scmp.com/rss/91/feed/', 'news', 'en', '{"limit": 15}', true),
('The Diplomat', 'rss', 'https://thediplomat.com/feed/', 'news', 'en', '{"limit": 15}', true),
('CNA Singapore', 'rss', 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', 'news', 'en', '{"limit": 15}', true),
('Japan Today', 'rss', 'https://japantoday.com/feed/atom', 'news', 'en', '{"limit": 10}', true),
('The Hindu', 'rss', 'https://www.thehindu.com/news/national/feeder/default.rss', 'news', 'en', '{"limit": 10}', true),
('ABC Australia', 'rss', 'https://www.abc.net.au/news/feed/2942460/rss.xml', 'news', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Regional: Middle East ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('BBC Middle East', 'rss', 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', 'news', 'en', '{"limit": 15}', true),
('Guardian Middle East', 'rss', 'https://www.theguardian.com/world/middleeast/rss', 'news', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Regional: Africa ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('BBC Africa', 'rss', 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', 'news', 'en', '{"limit": 15}', true)
ON CONFLICT DO NOTHING;

-- ═══ Regional: Latin America ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('BBC Latin America', 'rss', 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', 'news', 'en', '{"limit": 15}', true),
('Guardian Americas', 'rss', 'https://www.theguardian.com/world/americas/rss', 'news', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Tech ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('TechCrunch', 'rss', 'https://techcrunch.com/feed/', 'tech', 'en', '{"limit": 20}', true),
('MIT Tech Review', 'rss', 'https://www.technologyreview.com/feed/', 'tech', 'en', '{"limit": 15}', true),
('TechMeme', 'rss', 'https://www.techmeme.com/feed.xml', 'tech', 'en', '{"limit": 15}', true),
('ZDNet', 'rss', 'https://www.zdnet.com/news/rss.xml', 'tech', 'en', '{"limit": 15}', true),
('Engadget', 'rss', 'https://www.engadget.com/rss.xml', 'tech', 'en', '{"limit": 15}', true)
ON CONFLICT DO NOTHING;

-- ═══ AI ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('VentureBeat AI', 'rss', 'https://venturebeat.com/category/ai/feed/', 'tech', 'en', '{"limit": 15}', true),
('The Verge AI', 'rss', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'tech', 'en', '{"limit": 15}', true),
('MIT Tech Review AI', 'rss', 'https://www.technologyreview.com/topic/artificial-intelligence/feed', 'tech', 'en', '{"limit": 15}', true),
('Singularity Hub', 'rss', 'https://singularityhub.com/feed/', 'tech', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Dev / Open Source ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('GitHub Blog', 'rss', 'https://github.blog/feed/', 'tech', 'en', '{"limit": 10}', true),
('Dev.to', 'rss', 'https://dev.to/feed', 'tech', 'en', '{"limit": 15}', true),
('Lobsters', 'rss', 'https://lobste.rs/rss', 'tech', 'en', '{"limit": 15}', true),
('Product Hunt', 'rss', 'https://www.producthunt.com/feed', 'tech', 'en', '{"limit": 10}', true),
('InfoQ', 'rss', 'https://feed.infoq.com/', 'tech', 'en', '{"limit": 15}', true),
('The New Stack', 'rss', 'https://thenewstack.io/feed/', 'tech', 'en', '{"limit": 10}', true),
('Changelog', 'rss', 'https://changelog.com/feed', 'tech', 'en', '{"limit": 10}', true),
('HN Front Page', 'rss', 'https://hnrss.org/frontpage', 'tech', 'en', '{"limit": 20}', true)
ON CONFLICT DO NOTHING;

-- ═══ Science ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('ScienceDaily', 'rss', 'https://www.sciencedaily.com/rss/top.xml', 'science', 'en', '{"limit": 15}', true),
('Nature News', 'rss', 'https://feeds.nature.com/nature/rss/current', 'science', 'en', '{"limit": 15}', true),
('Live Science', 'rss', 'https://www.livescience.com/feeds/all', 'science', 'en', '{"limit": 15}', true),
('New Scientist', 'rss', 'https://www.newscientist.com/feed/home/', 'science', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Finance ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('Yahoo Finance', 'rss', 'https://finance.yahoo.com/rss/topstories', 'finance', 'en', '{"limit": 15}', true),
('CoinDesk', 'rss', 'https://www.coindesk.com/arc/outboundfeeds/rss/', 'finance', 'en', '{"limit": 15}', true),
('Cointelegraph', 'rss', 'https://cointelegraph.com/rss', 'finance', 'en', '{"limit": 10}', true),
('Federal Reserve', 'rss', 'https://www.federalreserve.gov/feeds/press_all.xml', 'finance', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Security ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('Krebs Security', 'rss', 'https://krebsonsecurity.com/feed/', 'tech', 'en', '{"limit": 10}', true),
('The Hacker News', 'rss', 'https://feeds.feedburner.com/TheHackersNews', 'tech', 'en', '{"limit": 15}', true),
('Schneier on Security', 'rss', 'https://www.schneier.com/feed/', 'tech', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Think Tanks / Policy ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('Foreign Policy', 'rss', 'https://foreignpolicy.com/feed/', 'news', 'en', '{"limit": 10}', true),
('Atlantic Council', 'rss', 'https://www.atlanticcouncil.org/feed/', 'news', 'en', '{"limit": 10}', true),
('Foreign Affairs', 'rss', 'https://www.foreignaffairs.com/rss.xml', 'news', 'en', '{"limit": 10}', true),
('War on the Rocks', 'rss', 'https://warontherocks.com/feed', 'news', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Positive / Feel Good ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('Good News Network', 'rss', 'https://www.goodnewsnetwork.org/feed/', 'news', 'en', '{"limit": 15}', true),
('Positive News', 'rss', 'https://www.positive.news/feed/', 'news', 'en', '{"limit": 10}', true),
('Reasons to be Cheerful', 'rss', 'https://reasonstobecheerful.world/feed/', 'news', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Europe (multi-language) ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('EuroNews', 'rss', 'https://www.euronews.com/rss?format=xml', 'news', 'en', '{"limit": 15}', true),
('Le Monde EN', 'rss', 'https://www.lemonde.fr/en/rss/une.xml', 'news', 'en', '{"limit": 10}', true),
('Tagesschau', 'rss', 'https://www.tagesschau.de/xml/rss2/', 'news', 'de', '{"limit": 10}', true),
('ANSA Italy', 'rss', 'https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml', 'news', 'it', '{"limit": 10}', true),
('NOS Nieuws', 'rss', 'https://feeds.nos.nl/nosnieuwsalgemeen', 'news', 'nl', '{"limit": 10}', true),
('SVT Nyheter', 'rss', 'https://www.svt.se/nyheter/rss.xml', 'news', 'sv', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Crisis / Humanitarian ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('WHO News', 'rss', 'https://www.who.int/rss-feeds/news-english.xml', 'science', 'en', '{"limit": 10}', true),
('Crisis Group', 'rss', 'https://www.crisisgroup.org/rss', 'news', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;

-- ═══ Startups ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active) VALUES
('Crunchbase News', 'rss', 'https://news.crunchbase.com/feed/', 'tech', 'en', '{"limit": 10}', true),
('Y Combinator Blog', 'rss', 'https://www.ycombinator.com/blog/rss/', 'tech', 'en', '{"limit": 10}', true),
('CB Insights', 'rss', 'https://www.cbinsights.com/research/feed/', 'tech', 'en', '{"limit": 10}', true)
ON CONFLICT DO NOTHING;
