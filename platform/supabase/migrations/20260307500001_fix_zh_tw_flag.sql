-- Fix zh-TW flag: 🇹🇼 renders broken on some systems, use 🇨🇳 instead
UPDATE platform_languages SET flag = '🇨🇳' WHERE code = 'zh-TW';
