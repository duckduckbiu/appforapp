#!/usr/bin/env python3
"""
Bill.ai News Scraper — Playwright + trafilatura + LLM polish

Architecture (cost-efficient: LLM only used for polishing):
  1. Read source URLs from feed_sources where source_type = 'browser_use'
  2. For each URL:
     a. Playwright renders the homepage (headless browser, handles JS)  — $0
     b. BeautifulSoup extracts article links from HTML                  — $0
     c. trafilatura extracts full article text, images, metadata        — $0
     d. Single LLM call rewrites article for copyright safety           — ~$0.001/article
  3. Stores in aggregated_feed with polished content

GitHub Actions secrets required:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  OPENROUTER_API_KEY          (for AI polish step only)

Usage:
  python ai_browser_scraper.py
  MAX_ARTICLES_PER_SOURCE=5 python ai_browser_scraper.py
"""

import asyncio
import hashlib
import json
import os
import re
import time
import traceback
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin, urlparse

from supabase import create_client

# ── Config ───────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

MAX_ARTICLES_PER_SOURCE = int(os.environ.get("MAX_ARTICLES_PER_SOURCE", "10"))
MAX_SOURCES_PER_RUN = int(os.environ.get("MAX_SOURCES_PER_RUN", "20"))

# LLM model via OpenRouter — only used for polish step (~$0.001/article)
LLM_MODEL = os.environ.get("LLM_MODEL", "google/gemini-2.0-flash-001")

# ── Helpers ──────────────────────────────────────────────────────────

def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:20]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Phase 1: Render page with Playwright & extract article links ─────

async def extract_article_links(source_url: str, source_name: str, max_articles: int) -> list[dict]:
    """
    Use Playwright to render the homepage, then BeautifulSoup to find article links.
    No LLM needed — pure HTML parsing with heuristics.
    """
    from playwright.async_api import async_playwright
    from bs4 import BeautifulSoup

    print(f"  [playwright] loading {source_url}...")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = await context.new_page()

            # Block heavy resources to speed up loading
            await page.route("**/*.{mp4,webm,ogg,mp3,wav,flac}", lambda route: route.abort())
            await page.route("**/{analytics,tracking,ads,advertisement}**", lambda route: route.abort())

            await page.goto(source_url, wait_until="domcontentloaded", timeout=30000)
            # Wait a bit for JS rendering
            await page.wait_for_timeout(3000)
            # Scroll down to trigger lazy loading
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 3)")
            await page.wait_for_timeout(1000)

            html = await page.content()
            await browser.close()

    except Exception as e:
        print(f"  [playwright] error loading page: {e}")
        return []

    # Parse with BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    base_domain = urlparse(source_url).netloc

    # Collect candidate article links
    candidates = []
    seen_urls = set()

    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"].strip()
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue

        # Resolve relative URLs
        full_url = urljoin(source_url, href)
        parsed = urlparse(full_url)

        # Must be same domain or common CDN pattern
        if parsed.netloc and parsed.netloc != base_domain:
            # Allow subdomains
            if not parsed.netloc.endswith("." + base_domain) and not base_domain.endswith("." + parsed.netloc):
                continue

        # Skip non-article URLs
        skip_patterns = [
            "/tag/", "/category/", "/author/", "/search", "/login", "/register",
            "/about", "/contact", "/privacy", "/terms", "/faq", "/help",
            "/video/", "/gallery/", "/podcast/", "/live/",
            ".pdf", ".jpg", ".png", ".gif", ".mp4",
            "facebook.com", "twitter.com", "instagram.com", "youtube.com",
        ]
        if any(p in full_url.lower() for p in skip_patterns):
            continue

        # Deduplicate
        clean_url = full_url.split("?")[0].split("#")[0]
        if clean_url in seen_urls:
            continue
        seen_urls.add(clean_url)

        # Extract title from the link or surrounding context
        title = _extract_title_from_link(a_tag)
        if not title or len(title) < 10:
            continue

        # Score the link — prefer longer titles, article-like URL patterns
        score = 0
        path = parsed.path.lower()

        # URL patterns that suggest articles
        if re.search(r"/\d{4}/\d{2}/", path):   # Date in URL
            score += 3
        if re.search(r"/article", path):
            score += 3
        if re.search(r"/news/", path):
            score += 2
        if re.search(r"/story/", path):
            score += 2
        if re.search(r"/\d+", path):             # Numeric ID
            score += 1
        if len(path.split("/")) >= 3:            # Deep path
            score += 1
        if len(title) > 30:                      # Substantial title
            score += 2
        if len(title) > 60:
            score += 1

        # Extract thumbnail image if nearby
        image_url = _extract_nearby_image(a_tag, source_url)

        candidates.append({
            "title": title,
            "url": full_url,
            "image_url": image_url,
            "score": score,
        })

    # Sort by score (highest first) and limit
    candidates.sort(key=lambda x: x["score"], reverse=True)
    top = candidates[:max_articles]

    print(f"  [links] {source_name}: found {len(candidates)} candidates, using top {len(top)}")
    return top


def _extract_title_from_link(a_tag) -> str:
    """Extract the best title text from an anchor tag and its context."""
    # Direct text content
    text = a_tag.get_text(strip=True)
    if text and len(text) >= 10:
        return text[:200]

    # Check for headline tags inside or near the link
    for tag_name in ["h1", "h2", "h3", "h4", "span"]:
        inner = a_tag.find(tag_name)
        if inner:
            text = inner.get_text(strip=True)
            if text and len(text) >= 10:
                return text[:200]

    # Check parent for headline context
    parent = a_tag.parent
    if parent:
        for tag_name in ["h1", "h2", "h3", "h4"]:
            headline = parent.find(tag_name)
            if headline:
                text = headline.get_text(strip=True)
                if text and len(text) >= 10:
                    return text[:200]

    # aria-label or title attribute
    for attr in ["aria-label", "title"]:
        val = a_tag.get(attr, "")
        if val and len(val) >= 10:
            return val[:200]

    return ""


def _extract_nearby_image(a_tag, base_url: str) -> Optional[str]:
    """Find a thumbnail image near the link."""
    # Check inside the link
    img = a_tag.find("img")
    if img:
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
        if src:
            return urljoin(base_url, src)

    # Check siblings
    parent = a_tag.parent
    if parent:
        img = parent.find("img")
        if img:
            src = img.get("src") or img.get("data-src") or ""
            if src:
                return urljoin(base_url, src)

    return None


# ── Phase 2: Extract full article with trafilatura ────────────────────

async def extract_full_article(article_url: str) -> Optional[dict]:
    """
    Use Playwright to render, then trafilatura to extract article content.
    No LLM needed — trafilatura handles text/metadata extraction.
    """
    import trafilatura

    print(f"    [fetch] {article_url[:80]}...")

    # First try trafilatura's built-in fetcher (fast, no browser needed)
    downloaded = trafilatura.fetch_url(article_url)

    if not downloaded:
        # Fallback: use Playwright for JS-heavy sites
        print(f"    [fetch] fallback to Playwright for {article_url[:60]}...")
        downloaded = await _fetch_with_playwright(article_url)

    if not downloaded:
        print(f"    [fetch] failed to download")
        return None

    # Extract with trafilatura
    result = trafilatura.extract(
        downloaded,
        include_images=True,
        include_links=False,
        include_comments=False,
        include_tables=False,
        output_format="json",
        with_metadata=True,
    )

    if not result:
        print(f"    [extract] trafilatura returned nothing")
        return None

    try:
        data = json.loads(result)
    except json.JSONDecodeError:
        print(f"    [extract] failed to parse trafilatura JSON")
        return None

    full_text = data.get("text", "")
    author = data.get("author")
    date = data.get("date")
    title = data.get("title")

    # Extract images from the HTML
    images = _extract_images_from_html(downloaded, article_url)

    # Extract video embeds from the HTML
    videos = _extract_videos_from_html(downloaded, article_url)

    return {
        "full_text": full_text,
        "title": title,
        "author": author,
        "published_date": date,
        "images": images,
        "videos": videos,
    }


async def _fetch_with_playwright(url: str) -> Optional[str]:
    """Fetch a page using Playwright when trafilatura's fetcher fails."""
    from playwright.async_api import async_playwright

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            )
            page = await context.new_page()
            await page.route("**/*.{mp4,webm,ogg,mp3,wav}", lambda route: route.abort())
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(2000)
            html = await page.content()
            await browser.close()
            return html
    except Exception as e:
        print(f"    [playwright] fallback error: {e}")
        return None


def _extract_images_from_html(html: str, base_url: str) -> list[str]:
    """Extract article images from HTML."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    images = []
    seen = set()

    # Find images in article-like containers
    for container_tag in ["article", "main", "[role='main']", ".article-body", ".post-content", ".story-body"]:
        container = soup.select_one(container_tag) if container_tag.startswith(("[", ".")) else soup.find(container_tag)
        if container:
            for img in container.find_all("img"):
                src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
                if not src:
                    continue
                full_src = urljoin(base_url, src)
                # Skip tiny images (likely icons/trackers)
                width = img.get("width", "")
                height = img.get("height", "")
                if (width and width.isdigit() and int(width) < 100) or (height and height.isdigit() and int(height) < 100):
                    continue
                if full_src not in seen:
                    seen.add(full_src)
                    images.append(full_src)
            if images:
                return images[:10]

    # Fallback: all images that look substantial
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        if not src:
            continue
        full_src = urljoin(base_url, src)
        # Skip data URIs, tracking pixels, tiny icons
        if full_src.startswith("data:") or "pixel" in full_src or "tracker" in full_src:
            continue
        if "logo" in full_src.lower() or "icon" in full_src.lower() or "avatar" in full_src.lower():
            continue
        if full_src not in seen:
            seen.add(full_src)
            images.append(full_src)

    return images[:10]


def _extract_videos_from_html(html: str, base_url: str) -> list[str]:
    """Extract video URLs from HTML (YouTube, Vimeo, direct video)."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    videos = []
    seen = set()

    # YouTube iframes
    for iframe in soup.find_all("iframe"):
        src = iframe.get("src") or iframe.get("data-src") or ""
        if "youtube.com/embed" in src or "youtu.be" in src:
            if src not in seen:
                seen.add(src)
                videos.append(src)
        elif "player.vimeo.com" in src:
            if src not in seen:
                seen.add(src)
                videos.append(src)

    # Direct video tags
    for video in soup.find_all("video"):
        src = video.get("src") or ""
        if src:
            full_src = urljoin(base_url, src)
            if full_src not in seen:
                seen.add(full_src)
                videos.append(full_src)
        for source in video.find_all("source"):
            src = source.get("src") or ""
            if src:
                full_src = urljoin(base_url, src)
                if full_src not in seen:
                    seen.add(full_src)
                    videos.append(full_src)

    return videos[:5]


# ── Phase 3: AI Polish (the ONLY step using LLM) ─────────────────────

POLISH_PROMPT_TEMPLATE = """You are a professional news editor. Rewrite the following article while:

1. KEEPING all factual information accurate and complete
2. CHANGING the wording, sentence structure, and expression style
3. MAINTAINING the same tone and reading experience
4. PRESERVING the article's structure (paragraphs, key points)
5. Using the SAME language as the original (if Chinese, write in Chinese; if German, write in German, etc.)
6. Making it read naturally and professionally
7. The rewritten article should be roughly the same length as the original

Also provide:
- A rewritten title (same facts, different wording)
- A one-sentence summary (under 100 characters)
- A category from: news, tech, ai, science, finance, crypto, politics, sports, entertainment, health, education, environment, business, lifestyle, security, general

Original Title: {title}

Original Article:
{content}

Return ONLY a JSON object:
{{"polished_title": "...", "polished_content": "...", "summary": "...", "category": "..."}}
"""


async def polish_article(title: str, content: str) -> Optional[dict]:
    """Single LLM call to rewrite an article. ~$0.001 per article."""
    import httpx

    prompt = POLISH_PROMPT_TEMPLATE.format(title=title, content=content[:6000])

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": LLM_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                        "max_tokens": 4096,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                polished = _parse_json_object(text)
                if polished:
                    return polished

        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate" in err_str.lower():
                wait = (attempt + 1) * 15
                print(f"    [polish] rate limited, waiting {wait}s (attempt {attempt+1}/3)")
                await asyncio.sleep(wait)
            else:
                print(f"    [polish] error: {e}")
                return None

    return None


# ── JSON parsing ─────────────────────────────────────────────────────

def _parse_json_object(text: str) -> Optional[dict]:
    """Extract a JSON object from text."""
    if not text:
        return None

    # Strip markdown code fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    return None


# ── DB Operations ────────────────────────────────────────────────────

def get_browser_sources(db) -> list[dict]:
    """Get all active browser_use sources."""
    try:
        result = (
            db.table("feed_sources")
            .select("*")
            .eq("source_type", "browser_use")
            .eq("is_active", True)
            .order("language")
            .limit(MAX_SOURCES_PER_RUN)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"[db] failed to load sources: {e}")
        return []


def article_exists(db, url: str) -> bool:
    """Check if article already exists."""
    try:
        result = db.table("aggregated_feed").select("id").eq("url", url).limit(1).execute()
        return bool(result.data)
    except Exception:
        return False


def insert_article(db, row: dict) -> bool:
    """Insert article into aggregated_feed."""
    try:
        db.table("aggregated_feed").upsert(row, on_conflict="source,source_id").execute()
        return True
    except Exception as e:
        print(f"    [db] insert error: {e}")
        return False


def update_source_stats(db, source_id: str, item_count: int, error: Optional[str] = None):
    """Update feed_sources stats."""
    try:
        update = {"last_fetched_at": now_iso(), "item_count": item_count}
        if error:
            update["last_error"] = error[:500]
            src = db.table("feed_sources").select("error_count").eq("id", source_id).limit(1).execute()
            current = (src.data[0]["error_count"] or 0) if src.data else 0
            update["error_count"] = current + 1
        else:
            update["error_count"] = 0
            update["last_error"] = None
        db.table("feed_sources").update(update).eq("id", source_id).execute()
    except Exception as e:
        print(f"  [db] stats error: {e}")


# ── Main pipeline ────────────────────────────────────────────────────

async def process_source(db, source: dict) -> int:
    """Process one source: render → extract links → fetch articles → polish."""
    source_name = source["name"]
    source_url = source.get("source_url") or ""
    language = source.get("language", "en")

    if not source_url:
        print(f"  [skip] {source_name}: no URL")
        return 0

    print(f"\n{'='*60}")
    print(f"  Source: {source_name} ({language})")
    print(f"  URL:    {source_url}")
    print(f"{'='*60}")

    # Phase 1: Extract article links (Playwright + BeautifulSoup, no LLM)
    articles = await extract_article_links(source_url, source_name, MAX_ARTICLES_PER_SOURCE)

    if not articles:
        update_source_stats(db, source["id"], 0, "No article links found")
        return 0

    inserted = 0

    for art in articles:
        art_url = (art.get("url") or "").strip()
        art_title = (art.get("title") or "").strip()

        if not art_url or not art_title:
            continue

        if article_exists(db, art_url):
            print(f"    [skip] exists: {art_title[:50]}")
            continue

        # Phase 2: Extract full article (trafilatura, no LLM)
        full = await extract_full_article(art_url)

        full_text = ""
        images = []
        videos = []
        author = None
        pub_date = None

        if full:
            full_text = full.get("full_text", "")
            author = full.get("author")
            pub_date = full.get("published_date")
            # Use trafilatura's title if better
            traf_title = full.get("title")
            if traf_title and len(traf_title) > len(art_title):
                art_title = traf_title
            images = [{"url": u, "alt": "", "storage_path": "", "width": None, "height": None}
                      for u in (full.get("images") or []) if u]
            videos = [{"url": u, "type": "embed", "thumbnail": None}
                      for u in (full.get("videos") or []) if u]

        if not full_text or len(full_text) < 80:
            print(f"    [skip] too short ({len(full_text)} chars): {art_title[:50]}")
            continue

        # Phase 3: AI Polish (the ONLY LLM call — ~$0.001)
        print(f"    [polish] {art_title[:60]}...")
        polished = await polish_article(art_title, full_text)

        polished_title = None
        polished_content = None
        ai_summary = None
        ai_category = None
        ai_status = "pending"

        if polished:
            polished_title = polished.get("polished_title")
            polished_content = polished.get("polished_content")
            ai_summary = polished.get("summary")
            ai_category = polished.get("category", "general")
            ai_status = "done"
            print(f"    [done] ✓ polished ({ai_category})")
        else:
            ai_status = "failed"
            print(f"    [warn] polish failed, keeping original")

        domain = urlparse(source_url).netloc or source_name
        image_url = images[0]["url"] if images else art.get("image_url")
        if not pub_date:
            pub_date = now_iso()

        row = {
            "source": domain,
            "source_id": url_hash(art_url),
            "title": art_title,
            "content": full_text[:500] if full_text else None,
            "url": art_url,
            "image_url": image_url,
            "author_name": author,
            "language": language,
            "published_at": pub_date,
            "fetched_at": now_iso(),
            "full_content": full_text,
            "full_content_status": "fetched" if len(full_text) > 100 else "failed",
            "images": images,
            "videos": videos,
            "word_count": len(full_text.split()) if full_text else 0,
            "score": 0,
            "tags": [ai_category] if ai_category else [],
            "polished_title": polished_title,
            "polished_content": polished_content,
            "ai_status": ai_status,
            "ai_category": ai_category,
            "ai_summary": ai_summary,
            "ai_model": LLM_MODEL,
            "ai_processed_at": now_iso() if ai_status == "done" else None,
        }

        if insert_article(db, row):
            inserted += 1

        # Brief pause between articles
        await asyncio.sleep(1)

    update_source_stats(db, source["id"], inserted)
    print(f"\n  [{source_name}] ✓ inserted {inserted} articles")
    return inserted


async def main() -> None:
    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    t0 = time.time()
    total = 0

    print(f"[config] model={LLM_MODEL} (polish only), max_per_source={MAX_ARTICLES_PER_SOURCE}")
    print(f"[config] LLM calls = 1 per article (polish only)")

    sources = get_browser_sources(db)
    print(f"[scraper] found {len(sources)} active sources")

    if not sources:
        print("[scraper] no sources. Add in admin with type 'browser_use'.")
        return

    for source in sources:
        try:
            n = await process_source(db, source)
            total += n
        except Exception as e:
            print(f"[error] {source['name']}: {e}")
            traceback.print_exc()
            update_source_stats(db, source["id"], 0, str(e)[:500])

        await asyncio.sleep(2)

    elapsed = round(time.time() - t0, 1)
    print(f"\n{'='*60}")
    print(f"  DONE: {total} articles from {len(sources)} sources in {elapsed}s")
    print(f"  LLM calls: ~{total} (polish only)")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
