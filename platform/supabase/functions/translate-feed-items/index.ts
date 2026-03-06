import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEEPLX_URL = "https://deeplx.mingming.dev/translate";
const MAX_BATCH = 10; // translate up to 10 items per request
const TRANSLATE_TIMEOUT = 10000;

interface TranslateResult {
  code: number;
  data: string;
}

async function translateText(text: string, targetLang: string): Promise<string | null> {
  try {
    const res = await fetch(DEEPLX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source_lang: "auto",
        target_lang: targetLang.toUpperCase(),
      }),
      signal: AbortSignal.timeout(TRANSLATE_TIMEOUT),
    });

    if (!res.ok) return null;
    const json: TranslateResult = await res.json();
    return json.code === 200 ? json.data : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { feed_ids, target_lang = "zh" } = await req.json();

    if (!Array.isArray(feed_ids) || feed_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "feed_ids array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const ids = feed_ids.slice(0, MAX_BATCH);

    // Check which translations already exist
    const { data: existing } = await db
      .from("feed_translations")
      .select("feed_id")
      .in("feed_id", ids)
      .eq("target_lang", target_lang);

    const existingIds = new Set((existing || []).map((r: { feed_id: string }) => r.feed_id));
    const toTranslate = ids.filter((id: string) => !existingIds.has(id));

    if (toTranslate.length === 0) {
      // All already translated, return cached
      const { data: cached } = await db
        .from("feed_translations")
        .select("*")
        .in("feed_id", ids)
        .eq("target_lang", target_lang);

      return new Response(
        JSON.stringify({ translations: cached || [], translated_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch feed items to translate
    const { data: feedItems } = await db
      .from("aggregated_feed")
      .select("id, title, content, language")
      .in("id", toTranslate);

    if (!feedItems || feedItems.length === 0) {
      return new Response(
        JSON.stringify({ translations: [], translated_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Translate sequentially (respect DeepLX rate limit ~30/min)
    const newTranslations: Array<{
      feed_id: string;
      target_lang: string;
      translated_title: string | null;
      translated_content: string | null;
    }> = [];

    for (const item of feedItems) {
      // Skip if already in target language
      if (item.language === target_lang) {
        newTranslations.push({
          feed_id: item.id,
          target_lang,
          translated_title: item.title,
          translated_content: item.content,
        });
        continue;
      }

      const [translatedTitle, translatedContent] = await Promise.all([
        item.title ? translateText(item.title, target_lang) : Promise.resolve(null),
        item.content ? translateText(item.content.slice(0, 500), target_lang) : Promise.resolve(null),
      ]);

      newTranslations.push({
        feed_id: item.id,
        target_lang,
        translated_title: translatedTitle || item.title,
        translated_content: translatedContent || item.content,
      });

      // Small delay between items to respect rate limit
      if (feedItems.indexOf(item) < feedItems.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Upsert translations
    if (newTranslations.length > 0) {
      await db.from("feed_translations").upsert(newTranslations, {
        onConflict: "feed_id,target_lang",
      });
    }

    // Return all translations for requested IDs
    const { data: allTranslations } = await db
      .from("feed_translations")
      .select("*")
      .in("feed_id", ids)
      .eq("target_lang", target_lang);

    return new Response(
      JSON.stringify({
        translations: allTranslations || [],
        translated_count: newTranslations.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
