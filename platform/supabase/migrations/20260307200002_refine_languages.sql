-- Refine language list: split zh into zh-CN/zh-TW, keep only major languages
DELETE FROM platform_languages;

INSERT INTO platform_languages (code, label_native, label_en, flag, is_enabled, sort_order) VALUES
  ('zh-CN', '简体中文',     'Simplified Chinese',  '🇨🇳', true,  1),
  ('zh-TW', '繁體中文',     'Traditional Chinese', '🇹🇼', true,  2),
  ('en',    'English',      'English',             '🇺🇸', true,  3),
  ('ja',    '日本語',        'Japanese',            '🇯🇵', false, 4),
  ('ko',    '한국어',         'Korean',              '🇰🇷', false, 5),
  ('es',    'Español',      'Spanish',             '🇪🇸', false, 6),
  ('fr',    'Français',     'French',              '🇫🇷', false, 7),
  ('de',    'Deutsch',      'German',              '🇩🇪', false, 8),
  ('pt',    'Português',    'Portuguese',          '🇧🇷', false, 9),
  ('ru',    'Русский',      'Russian',             '🇷🇺', false, 10),
  ('ar',    'العربية',       'Arabic',              '🇸🇦', false, 11),
  ('vi',    'Tiếng Việt',   'Vietnamese',          '🇻🇳', false, 12),
  ('th',    'ไทย',          'Thai',                '🇹🇭', false, 13);

-- Update existing user preferences from 'zh' to 'zh-CN'
UPDATE profiles SET preferred_language = 'zh-CN' WHERE preferred_language = 'zh';

-- Update feed_sources language from 'zh' to 'zh-CN'
UPDATE feed_sources SET language = 'zh-CN' WHERE language = 'zh';

-- Update existing articles language
UPDATE aggregated_feed SET language = 'zh-CN' WHERE language = 'zh';
