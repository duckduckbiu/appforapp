import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 速率限制配置：每分钟 30 次请求
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 30 };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 速率限制检查
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, corsHeaders);
  }

  try {
    const { text, targetLang = 'zh' } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Translating text:', text.substring(0, 50), 'to', targetLang);

    // 使用 DeepLX 免费 API (基于 DeepL，完全免费无需 API key)
    const response = await fetch('https://deeplx.mingming.dev/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        source_lang: 'auto',  // 自动检测源语言
        target_lang: targetLang.toUpperCase() // DeepLX 使用大写语言代码 (ZH, EN)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepLX API error:', response.status, errorText);
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('DeepLX response:', data);

    if (data.code !== 200) {
      console.error('DeepLX translation failed:', data);
      throw new Error(data.message || 'Translation failed');
    }

    console.log('Translation successful');

    return new Response(
      JSON.stringify({ 
        translatedText: data.data,  // DeepLX 返回 data 字段
        detectedLanguage: 'auto'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Translation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
