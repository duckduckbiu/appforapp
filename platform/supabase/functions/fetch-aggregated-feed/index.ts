import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FeedItem {
  source: string;
  source_id: string;
  title: string | null;
  content: string | null;
  url: string | null;
  image_url: string | null;
  author_name: string | null;
  score: number;
  tags: string[];
  language: string;
  published_at: string | null;
  // Normalization fields (Phase 1B)
  normalized_title?: string | null;
  reading_time_minutes?: number;
  content_hash?: string | null;
  raw_content?: string | null;
}

interface FeedSource {
  id: string;
  name: string;
  source_type: string;
  source_url: string | null;
  category: string;
  language: string;
  config: Record<string, unknown>;
  batch_group?: number;
  fetch_interval_minutes?: number;
  last_fetched_at?: string | null;
  error_count?: number;
  total_item_count?: number;
}

// ── RSS Parser (regex-based, no DOMParser dependency) ────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .trim();
}

/** Extract first text content of an XML tag (non-greedy) */
function xmlTag(xml: string, tag: string): string | null {
  // Handle both <tag>...</tag> and <tag><![CDATA[...]]></tag>
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  return (m[1] ?? m[2] ?? "").trim() || null;
}

/** Extract attribute value from an XML tag */
function xmlAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*?${attr}=["']([^"']+)["']`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

function extractImageFromHtml(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

// ── Content Normalization (Phase 1B) ─────────────────────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "") // curly quotes
    .replace(/[^\p{L}\p{N}\s]/gu, "") // keep letters, numbers, spaces
    .replace(/\s+/g, " ")
    .trim();
}

function hashString(str: string): string {
  // Simple FNV-1a 32-bit hash → hex
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function estimateReadingTime(text: string): number {
  // ~200 wpm English, ~300 cpm Chinese
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const words = text.replace(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g, "").split(/\s+/).filter(Boolean).length;
  const minutes = (cjk / 300) + (words / 200);
  return Math.max(1, Math.round(minutes));
}

function normalizeItem(item: FeedItem): FeedItem {
  const nt = item.title ? normalizeTitle(item.title) : null;
  const plainText = [item.title || "", item.content || ""].join(" ");
  return {
    ...item,
    normalized_title: nt,
    content_hash: nt ? hashString(nt) : null,
    reading_time_minutes: plainText.length > 10 ? estimateReadingTime(plainText) : 1,
    raw_content: item.content, // preserve original
  };
}

async function fetchRSS(src: FeedSource): Promise<FeedItem[]> {
  if (!src.source_url) return [];
  const limit = (src.config?.limit as number) || 20;

  const res = await fetch(src.source_url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BillAI/1.0; Feed Aggregator)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);

  const xml = await res.text();
  const items: FeedItem[] = [];

  // Split into <item>...</item> or <entry>...</entry> blocks
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = itemRegex.exec(xml)) !== null && count < limit) {
    const block = match[1] || match[2] || "";

    const title = xmlTag(block, "title");

    // Link: <link>url</link> or <link href="url" />
    let url = xmlTag(block, "link");
    if (!url) {
      url = xmlAttr(block, "link", "href");
    }

    // Description
    const rawDesc = xmlTag(block, "description") || xmlTag(block, "content") ||
      xmlTag(block, "summary") || xmlTag(block, "content:encoded") || "";
    const content = stripHtml(rawDesc) || null;

    // Image extraction chain
    let imageUrl: string | null = null;
    imageUrl = xmlAttr(block, "media:content", "url") || null;
    if (!imageUrl) imageUrl = xmlAttr(block, "media:thumbnail", "url") || null;
    if (!imageUrl) imageUrl = xmlAttr(block, "enclosure", "url") || null;
    if (!imageUrl && rawDesc) imageUrl = extractImageFromHtml(rawDesc);

    // Author
    const author = xmlTag(block, "dc:creator") || xmlTag(block, "author") ||
      xmlTag(block, "name") || null;

    // Date
    const pubDateStr = xmlTag(block, "pubDate") || xmlTag(block, "published") ||
      xmlTag(block, "updated") || xmlTag(block, "dc:date") || null;
    let publishedAt: string | null = null;
    if (pubDateStr) {
      try { publishedAt = new Date(pubDateStr).toISOString(); } catch { /* skip */ }
    }

    // Stable ID
    const sourceId = url || title || `${src.name}-${count}`;
    const hash = Array.from(new TextEncoder().encode(sourceId))
      .reduce((a, b) => ((a << 5) - a + b) | 0, 0)
      .toString(36);

    items.push({
      source: src.name.toLowerCase().replace(/\s+/g, "-"),
      source_id: `rss-${hash}`,
      title,
      content,
      url,
      image_url: imageUrl,
      author_name: author,
      score: 0,
      tags: [src.category, src.language],
      language: src.language || "en",
      published_at: publishedAt,
    });
    count++;
  }

  return items;
}

// ── HN Fetcher (preserved) ────────────────────────────────────────────

async function fetchHackerNews(src: FeedSource): Promise<FeedItem[]> {
  const limit = (src.config?.limit as number) || 30;
  const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", {
    signal: AbortSignal.timeout(10000),
  });
  const ids: number[] = await res.json();
  const topIds = ids.slice(0, limit);
  const items: FeedItem[] = [];

  for (let i = 0; i < topIds.length; i += 10) {
    const batch = topIds.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          signal: AbortSignal.timeout(8000),
        });
        return r.json();
      })
    );
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const item = result.value;
      if (!item || item.type !== "story") continue;
      items.push({
        source: "hackernews",
        source_id: String(item.id),
        title: item.title || null,
        content: item.text ? stripHtml(item.text).slice(0, 500) : null,
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        image_url: null,
        author_name: item.by || null,
        score: item.score || 0,
        tags: ["tech", src.language || "en"],
        language: src.language || "en",
        published_at: item.time ? new Date(item.time * 1000).toISOString() : null,
      });
    }
  }
  return items;
}

// ── Reddit Fetcher (preserved, runs server-side = no CORS) ────────────

async function fetchReddit(src: FeedSource): Promise<FeedItem[]> {
  const cfg = src.config as { subreddit?: string; sort?: string; limit?: number };
  const subreddit = cfg.subreddit || "technology";
  const sort = cfg.sort || "hot";
  const limit = cfg.limit || 25;

  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`,
    {
      headers: { "User-Agent": "BillAI/1.0 (Feed Aggregator)" },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) return [];
  const json = await res.json();
  const posts = json?.data?.children || [];

  return posts.map((child: { data: Record<string, unknown> }): FeedItem => {
    const d = child.data;
    let imageUrl: string | null = null;
    const preview = d.preview as { images?: { source?: { url?: string } }[] } | undefined;
    if (preview?.images?.[0]?.source?.url) {
      imageUrl = preview.images[0].source.url.replace(/&amp;/g, "&");
    }
    if (typeof d.thumbnail === "string" && d.thumbnail.startsWith("http") && !imageUrl) {
      imageUrl = d.thumbnail;
    }
    return {
      source: "reddit",
      source_id: String(d.id),
      title: String(d.title || ""),
      content: d.selftext ? String(d.selftext).slice(0, 500) : null,
      url: d.url ? String(d.url) : `https://reddit.com${d.permalink}`,
      image_url: imageUrl,
      author_name: d.author ? String(d.author) : null,
      score: Number(d.score) || 0,
      tags: ["reddit", subreddit, src.category || "tech"],
      language: src.language || "en",
      published_at: d.created_utc ? new Date(Number(d.created_utc) * 1000).toISOString() : null,
    };
  });
}

// ── Main Handler ──────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const db = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let batchGroup: number | null = null;
    let sourceId: string | null = null;
    let force = false;
    let concurrency = 1;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (typeof body.batch_group === "number") batchGroup = body.batch_group;
        if (typeof body.source_id === "string") sourceId = body.source_id;
        if (body.force === true) force = true;
        if (typeof body.concurrency === "number") concurrency = Math.min(Math.max(1, body.concurrency), 5);
      }
    } catch { /* no body = fetch all */ }

    // Build query: filter by source_id > batch_group > all active
    let query = db.from("feed_sources").select("*").eq("is_active", true);
    if (sourceId) {
      query = query.eq("id", sourceId);
    } else if (batchGroup !== null) {
      query = query.eq("batch_group", batchGroup);
    }
    const { data: sources } = await query;

    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ message: "No active sources", batch_group: batchGroup }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip sources fetched too recently, unless force=true or targeting a specific source
    const now = Date.now();
    const filteredSources = (force || sourceId)
      ? sources
      : sources.filter((src: FeedSource) => {
          if (!src.last_fetched_at) return true;
          const elapsed = now - new Date(src.last_fetched_at).getTime();
          const interval = (src.fetch_interval_minutes || 30) * 60 * 1000;
          return elapsed >= interval;
        });

    if (filteredSources.length === 0) {
      return new Response(JSON.stringify({ message: "All sources up to date", batch_group: batchGroup }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary: Record<string, { count: number; error?: string }> = {};

    // Process sources with configurable concurrency (default=1 serial, max=5)
    const CONCURRENCY = concurrency;
    for (let i = 0; i < filteredSources.length; i += CONCURRENCY) {
      const batch = filteredSources.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (src: FeedSource) => {
          let items: FeedItem[] = [];

          if (src.source_type === "hackernews") {
            items = await fetchHackerNews(src);
          } else if (src.source_type === "reddit") {
            items = await fetchReddit(src);
          } else if (src.source_type === "rss") {
            items = await fetchRSS(src);
          }

          // Normalize all items before upsert (Phase 1B)
          items = items.map(normalizeItem);

          if (items.length > 0) {
            await db.from("aggregated_feed").upsert(items, {
              onConflict: "source,source_id",
              ignoreDuplicates: false,
            });
          }

          // Update source metadata (cumulative total_item_count)
          await db.from("feed_sources").update({
            last_fetched_at: new Date().toISOString(),
            item_count: items.length,
            total_item_count: (src.total_item_count || 0) + items.length,
            error_count: 0,
            last_error: null,
          }).eq("id", src.id);

          return { name: src.name, count: items.length };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          summary[result.value.name] = { count: result.value.count };
        } else {
          const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          const failedSrc = batch[results.indexOf(result)];
          const name = failedSrc?.name || "unknown";
          summary[name] = { count: 0, error: errMsg };

          // Record error in DB
          if (failedSrc) {
            await db.from("feed_sources").update({
              error_count: (failedSrc.error_count || 0) + 1,
              last_error: errMsg,
            }).eq("id", failedSrc.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, batch_group: batchGroup, summary }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
