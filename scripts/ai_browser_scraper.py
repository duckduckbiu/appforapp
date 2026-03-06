#!/usr/bin/env python3
"""
Bill.ai AI Browser Scraper — browser-use + Gemini

Architecture:
  1. Read source URLs from feed_sources where source_type = 'browser_use'
  2. For each URL, launch a browser-use agent that:
     a. Opens the news website in a real browser
     b. AI visually reads the page to find article links
     c. Extracts: title, full text, images, videos, publish date
  3. AI polishes each article (rewrite for copyright safety)
  4. Stores in aggregated_feed with polished content

GitHub Actions secrets required:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  GOOGLE_API_KEY              (Gemini free tier)

Usage:
  python ai_browser_scraper.py                    # process all active browser_use sources
  MAX_ARTICLES_PER_SOURCE=5 python ai_browser_scraper.py  # limit per source
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

from supabase import create_client

# ── Config ───────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

MAX_ARTICLES_PER_SOURCE = int(os.environ.get("MAX_ARTICLES_PER_SOURCE", "10"))
MAX_SOURCES_PER_RUN = int(os.environ.get("MAX_SOURCES_PER_RUN", "20"))

# ── Helpers ──────────────────────────────────────────────────────────

def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:20]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Phase 1: Extract articles from a news website ────────────────────

EXTRACT_TASK_TEMPLATE = """You are a news extraction agent. Go to {url} and find the latest news articles on the page.

For each article (up to {max_articles}), extract:
1. title - the article headline
2. url - the full URL to the article
3. summary - a 1-2 sentence summary (from the visible preview text)
4. image_url - the article's thumbnail/hero image URL (if visible)
5. video_url - any embedded video URL (YouTube, etc.) if present
6. published_date - the publish date if visible (ISO format)
7. author - author name if visible

IMPORTANT:
- Only extract real news articles, skip ads, navigation links, and promotional content
- For image URLs, get the full absolute URL (not relative paths)
- For video URLs, look for embedded YouTube, Vimeo, or other video players
- If you need to scroll down to see more articles, do so
- Return results as a JSON array

Return ONLY a JSON array like this (no other text):
[
  {{
    "title": "Article Title",
    "url": "https://...",
    "summary": "Brief summary...",
    "image_url": "https://...",
    "video_url": null,
    "published_date": "2026-03-07T10:00:00Z",
    "author": "Author Name"
  }}
]
"""

EXTRACT_ARTICLE_TASK_TEMPLATE = """Go to {url} and extract the full article content.

Extract:
1. The complete article text (all paragraphs, in order)
2. All images in the article (full URLs)
3. All videos embedded in the article (YouTube, Vimeo, or direct video URLs)
4. The author name
5. The exact publish date

Return ONLY a JSON object (no other text):
{{
  "full_text": "The complete article text here...",
  "images": ["https://image1.jpg", "https://image2.jpg"],
  "videos": ["https://youtube.com/watch?v=..."],
  "author": "Author Name",
  "published_date": "2026-03-07T10:00:00Z"
}}
"""


# ── Phase 2: AI Polish (rewrite for copyright safety) ────────────────

POLISH_PROMPT_TEMPLATE = """You are a professional news editor. Rewrite the following article while:

1. KEEPING all factual information accurate and complete
2. CHANGING the wording, sentence structure, and expression style
3. MAINTAINING the same tone and reading experience
4. PRESERVING the article's structure (paragraphs, key points)
5. Using the SAME language as the original (if Chinese, write in Chinese; if Italian, write in Italian, etc.)
6. Making it read naturally and professionally
7. The rewritten article should be roughly the same length as the original

Also provide:
- A rewritten title (same facts, different wording)
- A one-sentence summary (under 100 characters)
- A category from this list: news, tech, ai, science, finance, crypto, politics, sports, entertainment, health, education, environment, business, lifestyle, security, general

Original Title: {title}

Original Article:
{content}

Return ONLY a JSON object (no other text):
{{
  "polished_title": "Rewritten title here",
  "polished_content": "Full rewritten article here...",
  "summary": "One sentence summary",
  "category": "news"
}}
"""


async def extract_articles_from_site(source_url: str, source_name: str, max_articles: int) -> list[dict]:
    """Use browser-use to visit a news site and extract article list."""
    from browser_use import Agent, BrowserSession, ChatGoogle

    llm = ChatGoogle(model="gemini-2.5-flash")
    browser = BrowserSession(headless=True)

    try:
        task = EXTRACT_TASK_TEMPLATE.format(url=source_url, max_articles=max_articles)
        agent = Agent(task=task, llm=llm, browser_session=browser)
        history = await agent.run()

        # Extract final result text from agent history
        result_text = history.final_result() or ""
        articles = _parse_json_array(result_text)

        if articles:
            print(f"  [browser-use] {source_name}: found {len(articles)} articles")
        else:
            print(f"  [browser-use] {source_name}: no articles extracted")

        return articles

    except Exception as e:
        print(f"  [browser-use] {source_name} error: {e}")
        traceback.print_exc()
        return []
    finally:
        await browser.stop()


async def extract_full_article(article_url: str) -> Optional[dict]:
    """Use browser-use to extract full content of a single article."""
    from browser_use import Agent, BrowserSession, ChatGoogle

    llm = ChatGoogle(model="gemini-2.5-flash")
    browser = BrowserSession(headless=True)

    try:
        task = EXTRACT_ARTICLE_TASK_TEMPLATE.format(url=article_url)
        agent = Agent(task=task, llm=llm, browser_session=browser)
        history = await agent.run()

        result_text = history.final_result() or ""
        article_data = _parse_json_object(result_text)
        return article_data

    except Exception as e:
        print(f"    [extract] {article_url[:60]} error: {e}")
        return None
    finally:
        await browser.stop()


async def polish_article(title: str, content: str) -> Optional[dict]:
    """Use Gemini to rewrite an article for copyright safety."""
    from browser_use import ChatGoogle
    llm = ChatGoogle(model="gemini-2.5-flash")

    prompt = POLISH_PROMPT_TEMPLATE.format(title=title, content=content[:8000])

    try:
        response = await llm.ainvoke(prompt)
        result_text = response.content if hasattr(response, "content") else str(response)
        polished = _parse_json_object(result_text)
        return polished

    except Exception as e:
        print(f"    [polish] error: {e}")
        return None


# ── JSON parsing helpers ─────────────────────────────────────────────

def _parse_json_array(text: str) -> list[dict]:
    """Extract a JSON array from text that may contain other content."""
    # Try direct parse
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    # Find JSON array in text
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass

    return []


def _parse_json_object(text: str) -> Optional[dict]:
    """Extract a JSON object from text that may contain other content."""
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
    """Get all active browser_use sources from feed_sources."""
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
    """Check if an article URL already exists in aggregated_feed."""
    try:
        result = (
            db.table("aggregated_feed")
            .select("id")
            .eq("url", url)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception:
        return False


def insert_article(db, row: dict) -> bool:
    """Insert a new article into aggregated_feed."""
    try:
        db.table("aggregated_feed").upsert(
            row, on_conflict="source,source_id"
        ).execute()
        return True
    except Exception as e:
        print(f"    [db] insert error: {e}")
        return False


def update_source_stats(db, source_id: str, item_count: int, error: Optional[str] = None):
    """Update feed_sources with fetch results."""
    try:
        update = {
            "last_fetched_at": now_iso(),
            "item_count": item_count,
        }
        if error:
            update["last_error"] = error[:500]
            # Increment error_count
            src = db.table("feed_sources").select("error_count").eq("id", source_id).limit(1).execute()
            current = (src.data[0]["error_count"] or 0) if src.data else 0
            update["error_count"] = current + 1
        else:
            update["error_count"] = 0
            update["last_error"] = None

        db.table("feed_sources").update(update).eq("id", source_id).execute()
    except Exception as e:
        print(f"  [db] update source stats error: {e}")


# ── Main pipeline ────────────────────────────────────────────────────

async def process_source(db, source: dict) -> int:
    """Process a single browser_use source: extract articles, get full content, polish."""
    source_name = source["name"]
    source_url = source.get("source_url") or ""
    language = source.get("language", "en")

    if not source_url:
        print(f"  [skip] {source_name}: no URL configured")
        return 0

    print(f"\n--- Processing: {source_name} ({language}) ---")
    print(f"    URL: {source_url}")

    # Phase 1: Extract article list from the news site homepage
    articles = await extract_articles_from_site(
        source_url, source_name, MAX_ARTICLES_PER_SOURCE
    )

    if not articles:
        update_source_stats(db, source["id"], 0, "No articles found")
        return 0

    inserted = 0

    for art in articles:
        art_url = (art.get("url") or "").strip()
        art_title = (art.get("title") or "").strip()

        if not art_url or not art_title:
            continue

        # Skip if already in DB
        if article_exists(db, art_url):
            print(f"    [skip] already exists: {art_title[:50]}")
            continue

        # Phase 2: Extract full article content
        print(f"    [extract] {art_title[:60]}...")
        full = await extract_full_article(art_url)

        full_text = ""
        images = []
        videos = []
        author = art.get("author")

        if full:
            full_text = full.get("full_text", "")
            images = [{"url": u, "alt": "", "storage_path": "", "width": None, "height": None}
                      for u in (full.get("images") or []) if u]
            videos = [{"url": u, "type": "embed", "thumbnail": None}
                      for u in (full.get("videos") or []) if u]
            author = full.get("author") or author

        # Use summary as fallback if full extraction failed
        if not full_text:
            full_text = art.get("summary", "")

        if not full_text or len(full_text) < 50:
            print(f"    [skip] too short: {art_title[:50]}")
            continue

        # Phase 3: AI Polish
        print(f"    [polish] rewriting...")
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
            print(f"    [done] polished: {(polished_title or art_title)[:50]}")
        else:
            ai_status = "failed"
            print(f"    [warn] polish failed, keeping original")

        # Build domain from source URL for source field
        from urllib.parse import urlparse
        domain = urlparse(source_url).netloc or source_name

        # Determine image_url: from article images, article listing, or full extraction
        image_url = None
        if images:
            image_url = images[0]["url"]
        elif art.get("image_url"):
            image_url = art["image_url"]

        # Parse publish date
        pub_date = art.get("published_date")
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
            # AI polished fields
            "polished_title": polished_title,
            "polished_content": polished_content,
            "ai_status": ai_status,
            "ai_category": ai_category,
            "ai_summary": ai_summary,
            "ai_model": "gemini-2.5-flash",
            "ai_processed_at": now_iso() if ai_status == "done" else None,
        }

        if insert_article(db, row):
            inserted += 1

    update_source_stats(db, source["id"], inserted)
    print(f"  [{source_name}] inserted {inserted} articles")
    return inserted


async def main() -> None:
    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    t0 = time.time()
    total = 0

    # Load all active browser_use sources
    sources = get_browser_sources(db)
    print(f"[browser-use] found {len(sources)} active sources")

    if not sources:
        print("[browser-use] no sources configured. Add sources in admin with type 'browser_use'.")
        return

    for source in sources:
        try:
            n = await process_source(db, source)
            total += n
        except Exception as e:
            print(f"[error] {source['name']}: {e}")
            traceback.print_exc()
            update_source_stats(db, source["id"], 0, str(e)[:500])

    elapsed = round(time.time() - t0, 1)
    print(f"\n=== AI Browser Scraper: {total} articles from {len(sources)} sources in {elapsed}s ===")


if __name__ == "__main__":
    asyncio.run(main())
