-- Phase 1C: Dynamic feed categories

CREATE TABLE IF NOT EXISTS feed_categories (
  id TEXT PRIMARY KEY,
  label_zh TEXT NOT NULL,
  label_en TEXT NOT NULL,
  icon TEXT,
  color_class TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feed_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_categories_public_read" ON feed_categories
  FOR SELECT USING (true);

CREATE POLICY "feed_categories_admin_write" ON feed_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seed 16 categories
INSERT INTO feed_categories (id, label_zh, label_en, icon, color_class, sort_order) VALUES
  ('news',          '新闻',   'News',           'Newspaper',     'red',      1),
  ('tech',          '科技',   'Tech',           'Code2',         'blue',     2),
  ('ai',            'AI',     'AI',             'Sparkles',      'violet',   3),
  ('science',       '科学',   'Science',        'FlaskConical',  'purple',   4),
  ('finance',       '财经',   'Finance',        'TrendingUp',    'green',    5),
  ('crypto',        '加密',   'Crypto',         'Coins',         'amber',    6),
  ('politics',      '政治',   'Politics',       'Landmark',      'slate',    7),
  ('sports',        '体育',   'Sports',         'Trophy',        'orange',   8),
  ('entertainment', '娱乐',   'Entertainment',  'Film',          'pink',     9),
  ('health',        '健康',   'Health',         'Heart',         'rose',    10),
  ('education',     '教育',   'Education',      'GraduationCap', 'cyan',    11),
  ('environment',   '环境',   'Environment',    'Leaf',          'emerald', 12),
  ('business',      '商业',   'Business',       'Briefcase',     'indigo',  13),
  ('lifestyle',     '生活',   'Lifestyle',      'Coffee',        'yellow',  14),
  ('security',      '安全',   'Security',       'Shield',        'red',     15),
  ('general',       '综合',   'General',        'Globe',         'gray',    16)
ON CONFLICT (id) DO NOTHING;
