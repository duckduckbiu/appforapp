-- ═══════════════════════════════════════════════════════════════
-- Multilingual RSS Feeds: 13 种语言全覆盖
-- Sources: awesome-rss-feeds, BBC World Service, 各国主流媒体
-- ═══════════════════════════════════════════════════════════════

-- ═══ 🇨🇳 zh-CN 简体中文 ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC 中文简体',         'rss', 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml',                'news',    'zh-CN', '{"limit": 20}', true, 'BBC 中文网简体版',     30),
('新华网',               'rss', 'https://rsshub.app/xinhuanet/news',                              'news',    'zh-CN', '{"limit": 20}', true, '新华社新闻',           30),
('中国新闻网',           'rss', 'https://www.chinanews.com.cn/rss/scroll-news.xml',               'news',    'zh-CN', '{"limit": 20}', true, '中国新闻网滚动新闻',   30),
('界面新闻',             'rss', 'https://rsshub.app/jiemian/list/4',                              'news',    'zh-CN', '{"limit": 15}', true, '界面新闻 — 时事',      30),
('观察者网',             'rss', 'https://rsshub.app/guancha/headline',                            'news',    'zh-CN', '{"limit": 15}', true, '观察者网头条',         30),
('华尔街见闻',           'rss', 'https://rsshub.app/wallstreetcn/news/global',                    'finance', 'zh-CN', '{"limit": 15}', true, '华尔街见闻全球资讯',   30),
('财新网',               'rss', 'https://rsshub.app/caixin/latest',                               'finance', 'zh-CN', '{"limit": 15}', true, '财新网最新报道',       30),
('南方周末',             'rss', 'https://rsshub.app/infzm/1',                                     'news',    'zh-CN', '{"limit": 10}', true, '南方周末深度报道',     60),
('知乎热榜',             'rss', 'https://rsshub.app/zhihu/hotlist',                               'general', 'zh-CN', '{"limit": 20}', true, '知乎热门话题',         30),
('果壳',                 'rss', 'https://rsshub.app/guokr/scientific',                            'science', 'zh-CN', '{"limit": 10}', true, '果壳科学人',           60),
('机器之心',             'rss', 'https://rsshub.app/jiqizhixin',                                  'tech',    'zh-CN', '{"limit": 15}', true, '机器之心 AI 资讯',     30),
('虎嗅',                 'rss', 'https://rsshub.app/huxiu/article',                               'tech',    'zh-CN', '{"limit": 15}', true, '虎嗅网热门文章',       30),
('爱范儿',               'rss', 'https://www.ifanr.com/feed',                                     'tech',    'zh-CN', '{"limit": 15}', true, '爱范儿 — 科技消费',    30)
ON CONFLICT DO NOTHING;

-- ═══ 🇹🇼 zh-TW 繁體中文 ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC 中文繁體',         'rss', 'https://feeds.bbci.co.uk/zhongwen/trad/rss.xml',                'news',    'zh-TW', '{"limit": 20}', true, 'BBC 中文網繁體版',       30),
('中央社 CNA 政治',      'rss', 'https://feeds.feedburner.com/rsscna/politics',                   'news',    'zh-TW', '{"limit": 15}', true, '中央通訊社政治新聞',     30),
('中央社 CNA 國際',      'rss', 'https://feeds.feedburner.com/rsscna/intworld',                   'news',    'zh-TW', '{"limit": 15}', true, '中央通訊社國際新聞',     30),
('中央社 CNA 財經',      'rss', 'https://feeds.feedburner.com/rsscna/finance',                    'finance', 'zh-TW', '{"limit": 15}', true, '中央通訊社財經新聞',     30),
('中央社 CNA 科技',      'rss', 'https://feeds.feedburner.com/rsscna/technology',                 'tech',    'zh-TW', '{"limit": 15}', true, '中央通訊社科技新聞',     30),
('聯合新聞網',           'rss', 'https://rsshub.app/udn/news/breakingnews/99',                   'news',    'zh-TW', '{"limit": 20}', true, '聯合新聞網即時新聞',     30),
('自由時報',             'rss', 'https://news.ltn.com.tw/rss/all.xml',                            'news',    'zh-TW', '{"limit": 20}', true, '自由時報即時新聞',       30),
('ETtoday 即時',         'rss', 'https://feeds.feedburner.com/ettoday/realtime',                  'news',    'zh-TW', '{"limit": 20}', true, 'ETtoday 新聞雲即時',     30),
('ETtoday 國際',         'rss', 'https://feeds.feedburner.com/ettoday/global',                    'news',    'zh-TW', '{"limit": 15}', true, 'ETtoday 國際新聞',       30),
('Taiwan Today',         'rss', 'https://www.taiwantoday.tw/rss.php',                             'news',    'zh-TW', '{"limit": 10}', true, 'Taiwan Today 臺灣新聞',  60),
('iThome',               'rss', 'https://www.ithome.com.tw/rss',                                  'tech',    'zh-TW', '{"limit": 15}', true, 'iThome 科技資訊',        30),
('關鍵評論網',           'rss', 'https://www.thenewslens.com/feed',                               'news',    'zh-TW', '{"limit": 15}', true, 'The News Lens 關鍵評論網', 30),
('風傳媒',               'rss', 'https://www.storm.mg/feeds/all',                                 'news',    'zh-TW', '{"limit": 15}', true, '風傳媒綜合新聞',         30),
('Taipei Times',         'rss', 'https://www.taipeitimes.com/xml/index.rss',                      'news',    'zh-TW', '{"limit": 10}', true, 'Taipei Times 英文臺灣', 60)
ON CONFLICT DO NOTHING;

-- ═══ 🇯🇵 ja 日本語 ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC Japanese',         'rss', 'https://feeds.bbci.co.uk/japanese/rss.xml',                      'news',    'ja', '{"limit": 20}', true, 'BBC ニュース 日本語',    30),
('NHK 主要ニュース',     'rss', 'https://www3.nhk.or.jp/rss/news/cat0.xml',                      'news',    'ja', '{"limit": 20}', true, 'NHK 総合ニュース',       30),
('NHK 政治',             'rss', 'https://www3.nhk.or.jp/rss/news/cat4.xml',                      'news',    'ja', '{"limit": 15}', true, 'NHK 政治ニュース',       30),
('NHK 経済',             'rss', 'https://www3.nhk.or.jp/rss/news/cat5.xml',                      'finance', 'ja', '{"limit": 15}', true, 'NHK 経済ニュース',       30),
('NHK 国際',             'rss', 'https://www3.nhk.or.jp/rss/news/cat6.xml',                      'news',    'ja', '{"limit": 15}', true, 'NHK 国際ニュース',       30),
('NHK IT科学',           'rss', 'https://www3.nhk.or.jp/rss/news/cat7.xml',                      'tech',    'ja', '{"limit": 15}', true, 'NHK IT・科学',           30),
('Japan Today',          'rss', 'https://japantoday.com/feed/atom',                               'news',    'ja', '{"limit": 15}', true, 'Japan Today ニュース',   30),
('日経 Nikkei Asia',     'rss', 'https://asia.nikkei.com/rss',                                    'finance', 'ja', '{"limit": 15}', true, '日経アジア',             30),
('Nippon.com',           'rss', 'https://www.nippon.com/ja/rss/all.rss',                          'news',    'ja', '{"limit": 10}', true, 'Nippon.com 日本語',      60),
('ITmedia',              'rss', 'https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml',             'tech',    'ja', '{"limit": 15}', true, 'ITmedia 総合',           30)
ON CONFLICT DO NOTHING;

-- ═══ 🇰🇷 ko 한국어 ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC Korean',           'rss', 'https://feeds.bbci.co.uk/korean/rss.xml',                        'news',    'ko', '{"limit": 20}', true, 'BBC 코리안 뉴스',       30),
('조선일보',             'rss', 'http://www.chosun.com/site/data/rss/rss.xml',                    'news',    'ko', '{"limit": 20}', true, '조선일보 메인뉴스',     30),
('중앙일보',             'rss', 'https://rss.joongang.co.kr/rss/joongang_list.xml',               'news',    'ko', '{"limit": 20}', true, '중앙일보 주요뉴스',     30),
('한겨레',               'rss', 'http://www.hani.co.kr/rss/',                                     'news',    'ko', '{"limit": 20}', true, '한겨레 전체기사',       30),
('Korea Herald',         'rss', 'http://www.koreaherald.com/rss',                                 'news',    'ko', '{"limit": 15}', true, 'The Korea Herald',      30),
('Korea Times',          'rss', 'https://www.koreatimes.co.kr/www2/common/rss.asp',               'news',    'ko', '{"limit": 15}', true, 'The Korea Times',       30),
('SBS 뉴스',             'rss', 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER', 'news', 'ko', '{"limit": 15}', true, 'SBS 뉴스 속보', 30),
('한국경제',             'rss', 'https://www.hankyung.com/feed/all-news',                         'finance', 'ko', '{"limit": 15}', true, '한국경제신문',           30),
('동아일보',             'rss', 'https://rss.donga.com/total.xml',                                'news',    'ko', '{"limit": 15}', true, '동아일보 전체뉴스',     30)
ON CONFLICT DO NOTHING;

-- ═══ 🇪🇸 es Español ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC Mundo',            'rss', 'https://feeds.bbci.co.uk/mundo/rss.xml',                         'news',    'es', '{"limit": 20}', true, 'BBC Mundo noticias',    30),
('EL PAÍS',              'rss', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', 'news', 'es', '{"limit": 20}', true, 'EL PAÍS portada',       30),
('El Confidencial',      'rss', 'https://rss.elconfidencial.com/espana/',                         'news',    'es', '{"limit": 15}', true, 'El Confidencial España', 30),
('ElDiario.es',          'rss', 'https://www.eldiario.es/rss/',                                   'news',    'es', '{"limit": 15}', true, 'ElDiario.es noticias',  30),
('Expansión',            'rss', 'https://e00-expansion.uecdn.es/rss/portada.xml',                 'finance', 'es', '{"limit": 15}', true, 'Expansión economía',    30),
('El Periódico',         'rss', 'https://www.elperiodico.com/es/rss/rss_portada.xml',             'news',    'es', '{"limit": 15}', true, 'El Periódico España',   30),
('RT en Español',        'rss', 'https://actualidad.rt.com/feed',                                 'news',    'es', '{"limit": 15}', true, 'RT en español',         30),
('France 24 ES',         'rss', 'https://www.france24.com/es/rss',                                'news',    'es', '{"limit": 15}', true, 'France 24 en español',  30),
('DW Español',           'rss', 'https://rss.dw.com/xml/rss-es-all',                             'news',    'es', '{"limit": 15}', true, 'Deutsche Welle español', 30),
('Infobae',              'rss', 'https://www.infobae.com/feeds/rss/',                             'news',    'es', '{"limit": 15}', true, 'Infobae noticias',      30)
ON CONFLICT DO NOTHING;

-- ═══ 🇫🇷 fr Français ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('Le Monde',             'rss', 'https://www.lemonde.fr/rss/une.xml',                             'news',    'fr', '{"limit": 20}', true, 'Le Monde à la une',     30),
('France 24 FR',         'rss', 'https://www.france24.com/fr/rss',                                'news',    'fr', '{"limit": 15}', true, 'France 24 en français', 30),
('Franceinfo',           'rss', 'https://www.francetvinfo.fr/titres.rss',                         'news',    'fr', '{"limit": 15}', true, 'Franceinfo actualités', 30),
('L''Obs',               'rss', 'https://www.nouvelobs.com/a-la-une/rss.xml',                    'news',    'fr', '{"limit": 15}', true, 'L''Obs actualités',     30),
('Ouest-France',         'rss', 'https://www.ouest-france.fr/rss-en-continu.xml',                'news',    'fr', '{"limit": 15}', true, 'Ouest-France continu',  30),
('Mediapart',            'rss', 'https://www.mediapart.fr/articles/feed',                         'news',    'fr', '{"limit": 10}', true, 'Mediapart articles',    60),
('La Presse',            'rss', 'https://www.lapresse.ca/actualites/rss',                         'news',    'fr', '{"limit": 15}', true, 'La Presse Montréal',    30),
('RFI Français',         'rss', 'https://www.rfi.fr/fr/rss',                                     'news',    'fr', '{"limit": 15}', true, 'RFI actualités monde',  30),
('DW Français',          'rss', 'https://rss.dw.com/xml/rss-fr-all',                             'news',    'fr', '{"limit": 15}', true, 'Deutsche Welle français', 30)
ON CONFLICT DO NOTHING;

-- ═══ 🇩🇪 de Deutsch ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('ZEIT ONLINE',          'rss', 'http://newsfeed.zeit.de/index',                                  'news',    'de', '{"limit": 20}', true, 'ZEIT ONLINE Nachrichten', 30),
('FAZ.NET',              'rss', 'https://www.faz.net/rss/aktuell/',                               'news',    'de', '{"limit": 20}', true, 'FAZ Aktuell',            30),
('FOCUS Online',         'rss', 'https://rss.focus.de/fol/XML/rss_folnews.xml',                  'news',    'de', '{"limit": 15}', true, 'FOCUS Online News',      30),
('DW Deutsch',           'rss', 'https://rss.dw.com/xml/rss-de-all',                             'news',    'de', '{"limit": 15}', true, 'Deutsche Welle Deutsch', 30),
('Spiegel',              'rss', 'https://www.spiegel.de/schlagzeilen/tops/index.rss',             'news',    'de', '{"limit": 15}', true, 'Spiegel Schlagzeilen',   30),
('Heise',                'rss', 'https://www.heise.de/rss/heise-atom.xml',                        'tech',    'de', '{"limit": 15}', true, 'Heise IT-Nachrichten',   30),
('Golem.de',             'rss', 'https://rss.golem.de/rss.php?feed=RSS2.0',                      'tech',    'de', '{"limit": 15}', true, 'Golem.de IT-News',       30),
('Handelsblatt',         'rss', 'https://www.handelsblatt.com/contentexport/feed/top-themen',     'finance', 'de', '{"limit": 15}', true, 'Handelsblatt Wirtschaft', 30)
ON CONFLICT DO NOTHING;

-- ═══ 🇧🇷 pt Português ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC Portuguese',       'rss', 'https://feeds.bbci.co.uk/portuguese/rss.xml',                    'news',    'pt', '{"limit": 20}', true, 'BBC Brasil',            30),
('Folha de S.Paulo',     'rss', 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml',        'news',    'pt', '{"limit": 20}', true, 'Folha Em Cima da Hora', 30),
('R7 Notícias',          'rss', 'https://noticias.r7.com/feed.xml',                               'news',    'pt', '{"limit": 15}', true, 'R7 notícias Brasil',    30),
('UOL Notícias',         'rss', 'http://rss.home.uol.com.br/index.xml',                           'news',    'pt', '{"limit": 15}', true, 'UOL notícias',          30),
('Portal EBC',           'rss', 'http://www.ebc.com.br/rss/feed.xml',                             'news',    'pt', '{"limit": 15}', true, 'Agência Brasil',        30),
('DW Português',         'rss', 'https://rss.dw.com/xml/rss_br-all',                             'news',    'pt', '{"limit": 15}', true, 'Deutsche Welle Brasil', 30),
('Público',              'rss', 'https://feeds.feedburner.com/PublicoRSS',                        'news',    'pt', '{"limit": 15}', true, 'Público (Portugal)',    30),
('Observador',           'rss', 'https://observador.pt/feed/',                                    'news',    'pt', '{"limit": 15}', true, 'Observador Portugal',   30)
ON CONFLICT DO NOTHING;

-- ═══ 🇷🇺 ru Русский ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC Russian',          'rss', 'https://feeds.bbci.co.uk/russian/rss.xml',                       'news',    'ru', '{"limit": 20}', true, 'BBC Русская служба',    30),
('ТАСС',                 'rss', 'http://tass.com/rss/v2.xml',                                     'news',    'ru', '{"limit": 20}', true, 'ТАСС Информагентство', 30),
('Лента.ру',             'rss', 'https://lenta.ru/rss',                                           'news',    'ru', '{"limit": 20}', true, 'Lenta.ru новости',      30),
('РИА Новости',          'rss', 'https://ria.ru/export/rss2/index.xml',                           'news',    'ru', '{"limit": 20}', true, 'RIA Novosti',           30),
('RT Russian',           'rss', 'https://russian.rt.com/rss',                                     'news',    'ru', '{"limit": 15}', true, 'RT на русском',         30),
('Вести.ру',             'rss', 'https://www.vesti.ru/vesti.rss',                                 'news',    'ru', '{"limit": 15}', true, 'Вести.Ru',              30),
('Moscow Times',         'rss', 'https://www.themoscowtimes.com/rss/news',                        'news',    'ru', '{"limit": 15}', true, 'The Moscow Times',      30),
('Хабр',                 'rss', 'https://habr.com/ru/rss/best/daily/',                            'tech',    'ru', '{"limit": 15}', true, 'Хабр — IT-сообщество', 30)
ON CONFLICT DO NOTHING;

-- ═══ 🇸🇦 ar العربية ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC Arabic',           'rss', 'https://feeds.bbci.co.uk/arabic/rss.xml',                        'news',    'ar', '{"limit": 20}', true, 'BBC عربي',              30),
('الجزيرة',              'rss', 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4571-a604-c0450fda6774/73d0e1b4-532f-45ef-b135-bfdff8b8cab9', 'news', 'ar', '{"limit": 20}', true, 'الجزيرة نت', 30),
('العربية',              'rss', 'https://www.alarabiya.net/tools/rss/arb/all.rss',                'news',    'ar', '{"limit": 20}', true, 'العربية أخبار',         30),
('الشرق الأوسط',         'rss', 'https://aawsat.com/feed',                                        'news',    'ar', '{"limit": 15}', true, 'Asharq Al-Awsat',       30),
('RT Arabic',            'rss', 'https://arabic.rt.com/rss/',                                     'news',    'ar', '{"limit": 15}', true, 'RT العربية',            30),
('DW Arabic',            'rss', 'https://rss.dw.com/xml/rss-ar-all',                             'news',    'ar', '{"limit": 15}', true, 'Deutsche Welle عربي',   30),
('France 24 AR',         'rss', 'https://www.france24.com/ar/rss',                                'news',    'ar', '{"limit": 15}', true, 'France 24 بالعربية',    30),
('Arab News',            'rss', 'https://www.arabnews.com/rss.xml',                               'news',    'ar', '{"limit": 15}', true, 'Arab News EN',          30)
ON CONFLICT DO NOTHING;

-- ═══ 🇻🇳 vi Tiếng Việt ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC Vietnamese',       'rss', 'https://feeds.bbci.co.uk/vietnamese/rss.xml',                    'news',    'vi', '{"limit": 20}', true, 'BBC Tiếng Việt',        30),
('VnExpress',            'rss', 'https://vnexpress.net/rss/tin-moi-nhat.rss',                     'news',    'vi', '{"limit": 20}', true, 'VnExpress tin mới nhất', 30),
('VnExpress Thời sự',    'rss', 'https://vnexpress.net/rss/thoi-su.rss',                          'news',    'vi', '{"limit": 15}', true, 'VnExpress thời sự',     30),
('VnExpress Kinh doanh', 'rss', 'https://vnexpress.net/rss/kinh-doanh.rss',                      'finance', 'vi', '{"limit": 15}', true, 'VnExpress kinh doanh',  30),
('VnExpress Công nghệ',  'rss', 'https://vnexpress.net/rss/so-hoa.rss',                           'tech',    'vi', '{"limit": 15}', true, 'VnExpress công nghệ',   30),
('VnExpress Khoa học',   'rss', 'https://vnexpress.net/rss/khoa-hoc.rss',                         'science', 'vi', '{"limit": 10}', true, 'VnExpress khoa học',    60),
('Thanh Niên',           'rss', 'https://thanhnien.vn/rss/home.rss',                              'news',    'vi', '{"limit": 20}', true, 'Báo Thanh Niên',        30),
('Việt Nam News',        'rss', 'https://vietnamnews.vn/rss/vietnamnews.rss',                     'news',    'vi', '{"limit": 15}', true, 'Việt Nam News EN',      30),
('Pháp Luật',            'rss', 'https://plo.vn/rss/home.rss',                                   'news',    'vi', '{"limit": 15}', true, 'Pháp Luật Online',      30)
ON CONFLICT DO NOTHING;

-- ═══ 🇹🇭 th ไทย ═══
INSERT INTO feed_sources (name, source_type, source_url, category, language, config, is_active, description, fetch_interval_minutes) VALUES
('BBC Thai',             'rss', 'https://feeds.bbci.co.uk/thai/rss.xml',                          'news',    'th', '{"limit": 20}', true, 'BBC ไทย',               30),
('Bangkok Post',         'rss', 'https://www.bangkokpost.com/rss/data/most-recent.xml',           'news',    'th', '{"limit": 20}', true, 'Bangkok Post ข่าวล่าสุด', 30),
('Bangkok Post Business','rss', 'https://www.bangkokpost.com/rss/data/business.xml',              'finance', 'th', '{"limit": 15}', true, 'Bangkok Post ธุรกิจ',    30),
('Bangkok Post Tech',    'rss', 'https://www.bangkokpost.com/rss/data/tech.xml',                  'tech',    'th', '{"limit": 15}', true, 'Bangkok Post เทคโนโลยี', 30),
('Nation Thailand',      'rss', 'https://www.nationthailand.com/rss',                             'news',    'th', '{"limit": 15}', true, 'Nation Thailand news',  30),
('Thai PBS',             'rss', 'https://www.thaipbs.or.th/rss',                                  'news',    'th', '{"limit": 15}', true, 'Thai PBS ข่าว',         30)
ON CONFLICT DO NOTHING;

-- ═══ Update existing zh → zh-CN for previously inserted sources ═══
-- (migration 20260307200002 already handled feed_sources.language,
--  but in case any were inserted with 'zh' after that migration)
UPDATE feed_sources SET language = 'zh-CN' WHERE language = 'zh';
