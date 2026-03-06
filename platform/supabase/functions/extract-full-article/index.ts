/**
 * extract-full-article — 全文提取 + 图片本地化 Edge Function
 *
 * 从 aggregated_feed 中取 pending 文章，通过 Jina Reader API (r.jina.ai)
 * 获取全文 Markdown，转换为 HTML，下载图片到 Supabase Storage。
 *
 * 调用方式：POST /functions/v1/extract-full-article
 * Body (可选): { "limit": 10, "article_id": "uuid" }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { marked } from "https://esm.sh/marked@12";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Config ─────────────────────────────────────────────────────────────

const MAX_ARTICLES_PER_RUN = 10;
const MAX_IMAGES_PER_ARTICLE = 10;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 20_000; // 20s (Jina may be slower than direct fetch)
const TOTAL_TIMEOUT_MS = 300_000; // 300s total

// ── Types ──────────────────────────────────────────────────────────────

interface ImageInfo {
  url: string;
  storage_path: string;
  alt: string;
  width: number | null;
  height: number | null;
}

interface VideoInfo {
  url: string;
  type: string;
  thumbnail: string | null;
}

interface ArticleRow {
  id: string;
  url: string;
  title: string | null;
  language: string;
  image_url: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Fetch with timeout */
async function fetchWithTimeout(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Extract image URLs from HTML string */
function extractImageUrls(html: string): { url: string; alt: string }[] {
  const results: { url: string; alt: string }[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    if (
      url.startsWith("data:") ||
      url.includes("1x1") ||
      url.includes("pixel") ||
      url.endsWith(".svg")
    ) {
      continue;
    }
    const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
    results.push({ url, alt: altMatch?.[1] || "" });
  }
  return results;
}

/** Extract video embeds from HTML */
function extractVideos(html: string): VideoInfo[] {
  const videos: VideoInfo[] = [];
  const seen = new Set<string>();

  const ytPatterns = [
    /(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi,
  ];
  for (const pattern of ytPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const videoId = match[1];
      if (seen.has(videoId)) continue;
      seen.add(videoId);
      videos.push({
        url: `https://www.youtube.com/embed/${videoId}`,
        type: "youtube",
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
  }

  const vimeoPattern = /vimeo\.com\/(?:video\/)?(\d+)/gi;
  let vimeoMatch;
  while ((vimeoMatch = vimeoPattern.exec(html)) !== null) {
    const videoId = vimeoMatch[1];
    if (seen.has(`vimeo-${videoId}`)) continue;
    seen.add(`vimeo-${videoId}`);
    videos.push({
      url: `https://player.vimeo.com/video/${videoId}`,
      type: "vimeo",
      thumbnail: null,
    });
  }

  return videos;
}

/** Get file extension from URL or content-type */
function getExtension(url: string, contentType?: string | null): string {
  if (contentType) {
    const map: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/avif": "avif",
    };
    for (const [mime, ext] of Object.entries(map)) {
      if (contentType.includes(mime)) return ext;
    }
  }
  const pathMatch = url.match(/\.(\w{3,4})(?:\?|#|$)/);
  if (pathMatch) {
    const ext = pathMatch[1].toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  }
  return "jpg";
}

/** Simple hash for naming files */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

/** Count words (handles CJK and Latin) */
function countWords(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g);
  const cjkCount = cjk ? cjk.length : 0;
  const latin = text
    .replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return cjkCount + latin.length;
}

// ── Jina Reader ────────────────────────────────────────────────────────

interface JinaResponse {
  code: number;
  data?: {
    title?: string;
    url?: string;
    content?: string;
    description?: string;
  };
}

/** Fetch full article content via Jina Reader API */
async function fetchViaJina(url: string): Promise<string | null> {
  const jinaUrl = `https://r.jina.ai/${url}`;

  try {
    const res = await fetchWithTimeout(jinaUrl, FETCH_TIMEOUT_MS, {
      headers: {
        "Accept": "application/json",
        "X-No-Cache": "true",
        "X-Return-Format": "markdown",
      },
    });

    if (!res.ok) {
      console.warn(`Jina returned HTTP ${res.status} for ${url}`);
      return null;
    }

    const json: JinaResponse = await res.json();
    const content = json.data?.content?.trim() || "";

    // Reject if suspiciously short (probably a paywall/bot-block page)
    if (content.length < 200) {
      console.warn(`Jina content too short (${content.length} chars) for ${url}`);
      return null;
    }

    return content;
  } catch (err) {
    console.warn(`Jina fetch error for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Core extraction ────────────────────────────────────────────────────

async function processArticle(
  article: ArticleRow,
  db: ReturnType<typeof createClient>,
): Promise<{ status: string; error?: string }> {
  if (!article.url) {
    await db
      .from("aggregated_feed")
      .update({
        full_content_status: "skipped",
        extraction_error: "No URL available",
        extracted_at: new Date().toISOString(),
      })
      .eq("id", article.id);
    return { status: "skipped" };
  }

  try {
    // 1. Fetch Markdown via Jina Reader
    const markdownContent = await fetchViaJina(article.url);

    if (!markdownContent) {
      await db
        .from("aggregated_feed")
        .update({
          full_content_status: "failed",
          extraction_error: "Jina Reader returned empty or blocked content",
          extracted_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      return { status: "failed", error: "Empty content from Jina" };
    }

    // 2. Convert Markdown → HTML
    let htmlContent = marked.parse(markdownContent) as string;

    // 3. Download images found in the HTML and upload to Supabase Storage
    const rawImages = extractImageUrls(htmlContent);
    const images: ImageInfo[] = [];
    const mediaRecords: {
      article_id: string;
      original_url: string;
      storage_path: string;
      file_size: number | null;
      mime_type: string | null;
    }[] = [];

    for (const img of rawImages.slice(0, MAX_IMAGES_PER_ARTICLE)) {
      try {
        const res = await fetchWithTimeout(img.url, 10_000);
        if (!res.ok) continue;

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.startsWith("image/")) continue;

        const contentLength = parseInt(res.headers.get("content-length") || "0");
        if (contentLength > MAX_IMAGE_SIZE_BYTES) continue;

        const blob = await res.blob();
        if (blob.size > MAX_IMAGE_SIZE_BYTES) continue;

        const ext = getExtension(img.url, contentType);
        const hash = simpleHash(img.url);
        const storagePath = `${article.id}/${hash}.${ext}`;

        const { error: uploadError } = await db.storage
          .from("feed-media")
          .upload(storagePath, blob, {
            contentType: contentType || "image/jpeg",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for ${img.url}:`, uploadError);
          continue;
        }

        const { data: publicUrlData } = db.storage
          .from("feed-media")
          .getPublicUrl(storagePath);

        const publicUrl = publicUrlData.publicUrl;
        htmlContent = htmlContent.replaceAll(img.url, publicUrl);

        images.push({
          url: publicUrl,
          storage_path: storagePath,
          alt: img.alt,
          width: null,
          height: null,
        });

        mediaRecords.push({
          article_id: article.id,
          original_url: img.url,
          storage_path: storagePath,
          file_size: blob.size,
          mime_type: contentType,
        });
      } catch (imgErr) {
        console.warn(
          `Image download failed: ${img.url}`,
          imgErr instanceof Error ? imgErr.message : imgErr,
        );
      }
    }

    // 4. Extract videos
    const videos = extractVideos(htmlContent);

    // 5. Count words
    const plainText = htmlContent.replace(/<[^>]*>/g, " ").trim();
    const wordCount = countWords(plainText);

    // 6. Update DB
    await db
      .from("aggregated_feed")
      .update({
        full_content: htmlContent,
        full_content_status: "fetched",
        images: JSON.stringify(images),
        videos: JSON.stringify(videos),
        word_count: wordCount,
        extraction_error: null,
        extracted_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    if (mediaRecords.length > 0) {
      await db.from("feed_media").insert(mediaRecords);
    }

    return { status: "fetched" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db
      .from("aggregated_feed")
      .update({
        full_content_status: "failed",
        extraction_error: errorMsg.slice(0, 500),
        extracted_at: new Date().toISOString(),
      })
      .eq("id", article.id);
    return { status: "failed", error: errorMsg };
  }
}

// ── Main Handler ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const db = createClient(supabaseUrl, supabaseKey);

    let limit = MAX_ARTICLES_PER_RUN;
    let specificArticleId: string | null = null;

    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (typeof body.limit === "number") {
          limit = Math.min(body.limit, MAX_ARTICLES_PER_RUN);
        }
        if (typeof body.article_id === "string") {
          specificArticleId = body.article_id;
        }
      }
    } catch {
      /* no body */
    }

    let query = db
      .from("aggregated_feed")
      .select("id, url, title, language, image_url");

    if (specificArticleId) {
      query = query.eq("id", specificArticleId);
    } else {
      query = query
        .eq("full_content_status", "pending")
        .not("url", "is", null)
        .order("published_at", { ascending: false })
        .limit(limit);
    }

    const { data: articles, error: queryError } = await query;

    if (queryError) throw new Error(`Query error: ${queryError.message}`);

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending articles", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Record<string, { status: string; title?: string; error?: string }> = {};
    let processed = 0, fetched = 0, failed = 0, skipped = 0;

    for (const article of articles) {
      if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
        console.warn("Total timeout reached, stopping early");
        break;
      }

      const result = await processArticle(article as ArticleRow, db);
      results[article.id] = { ...result, title: article.title?.slice(0, 60) || undefined };

      processed++;
      if (result.status === "fetched") fetched++;
      else if (result.status === "failed") failed++;
      else if (result.status === "skipped") skipped++;

      if (processed < articles.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    return new Response(
      JSON.stringify({ success: true, processed, fetched, failed, skipped, elapsed_seconds: elapsed, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
