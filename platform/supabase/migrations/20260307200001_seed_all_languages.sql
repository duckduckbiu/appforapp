-- Pre-seed 18 standard languages (zh and en already exist)
INSERT INTO platform_languages (code, label_native, label_en, flag, is_enabled, sort_order) VALUES
  ('ja', '日本語',        'Japanese',    '🇯🇵', false, 3),
  ('ko', '한국어',         'Korean',      '🇰🇷', false, 4),
  ('fr', 'Français',     'French',      '🇫🇷', false, 5),
  ('de', 'Deutsch',      'German',      '🇩🇪', false, 6),
  ('es', 'Español',      'Spanish',     '🇪🇸', false, 7),
  ('pt', 'Português',    'Portuguese',  '🇧🇷', false, 8),
  ('ru', 'Русский',      'Russian',     '🇷🇺', false, 9),
  ('ar', 'العربية',       'Arabic',      '🇸🇦', false, 10),
  ('hi', 'हिन्दी',         'Hindi',       '🇮🇳', false, 11),
  ('it', 'Italiano',     'Italian',     '🇮🇹', false, 12),
  ('th', 'ไทย',          'Thai',        '🇹🇭', false, 13),
  ('vi', 'Tiếng Việt',   'Vietnamese',  '🇻🇳', false, 14),
  ('id', 'Bahasa Indonesia', 'Indonesian', '🇮🇩', false, 15),
  ('ms', 'Bahasa Melayu','Malay',       '🇲🇾', false, 16),
  ('tr', 'Türkçe',       'Turkish',     '🇹🇷', false, 17),
  ('nl', 'Nederlands',   'Dutch',       '🇳🇱', false, 18)
ON CONFLICT (code) DO NOTHING;
