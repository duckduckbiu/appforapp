#!/usr/bin/env python3
"""
Bill.ai News Fetcher — GDELT + fundus + trafilatura

Architecture:
  - fundus   : crawls 171 major publishers directly, returns full article content
  - GDELT    : free news index covering 100+ languages, returns article URLs
  - trafilatura : extracts full text from GDELT article URLs

Usage:
  SOURCE=both python fetch_news.py          # default
  SOURCE=fundus python fetch_news.py
  SOURCE=gdelt python fetch_news.py

GitHub Actions secrets required:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from typing import Optional

import markdown as md_lib
import requests
import trafilatura
from supabase import create_client

# ── Config ───────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SOURCE_ARG = os.environ.get("SOURCE", "both")  # "fundus" | "gdelt" | "both"

MAX_FUNDUS_ARTICLES = int(os.environ.get("MAX_FUNDUS_ARTICLES", "50"))
MAX_GDELT_PER_QUERY = int(os.environ.get("MAX_GDELT_PER_QUERY", "20"))

# ISO 639 → 2-letter code used in aggregated_feed.language
LANG_MAP: dict[str, str] = {
    "English": "en", "eng": "en",
    "Chinese": "zh", "zho": "zh", "chi": "zh",
    "Korean": "ko", "kor": "ko",
    "Japanese": "ja", "jpn": "ja",
    "Spanish": "es", "spa": "es",
    "French": "fr", "fra": "fr",
    "German": "de", "deu": "de",
    "Portuguese": "pt", "por": "pt",
    "Arabic": "ar", "ara": "ar",
    "Russian": "ru", "rus": "ru",
    "Thai": "th", "tha": "th",
    "Vietnamese": "vi", "vie": "vi",
    "Indonesian": "id", "ind": "id",
    "Italian": "it", "ita": "it",
    "Dutch": "nl", "nld": "nl",
    "Polish": "pl", "pol": "pl",
    "Turkish": "tr", "tur": "tr",
}

# GDELT supplementary queries: (search terms, GDELT lang code, tags for DB)
# Reduced to 8 queries to stay under rate limits.
# Korean (kor) removed — GDELT API returns invalid JSON for that lang code.
GDELT_QUERIES: list[tuple[str, str, list[str]]] = [
    # English — combine topics to reduce query count
    ("breaking news world politics government", "eng", ["world", "politics"]),
    ("technology artificial intelligence economy finance", "eng", ["tech", "finance"]),
    # Chinese
    ("科技 人工智能 创新 经济 世界新闻", "zho", ["tech", "world"]),
    # Japanese
    ("テクノロジー 世界ニュース 経済", "jpn", ["world", "tech"]),
    # Spanish
    ("tecnología política economía mundo", "spa", ["world"]),
    # French
    ("politique économie technologie monde", "fra", ["world", "tech"]),
    # German
    ("Technologie Wirtschaft Politik Welt", "deu", ["world", "tech"]),
    # Arabic
    ("أخبار العالم تكنولوجيا", "ara", ["world", "tech"]),
]


# ── Helpers ──────────────────────────────────────────────────────────

def url_hash(url: str) -> str:
    """Deterministic 20-char ID from URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:20]


def normalize_lang(code: str) -> str:
    return LANG_MAP.get(code, code[:2].lower() if code else "en")


def text_to_html(text: str) -> str:
    """
    Convert Markdown/plain text to HTML.
    Handles: paragraphs, headings, bold/italic, links [text](url),
    images ![alt](url), and lists.
    """
    if not text.strip():
        return ""
    return md_lib.markdown(
        text,
        extensions=["nl2br", "sane_lists"],
    )


def upsert_article(db, row: dict) -> str:
    """
    Insert article or upgrade existing one:
    - If URL already in DB with full content → skip
    - If URL already in DB but missing full content → UPDATE with new content
    - If URL not in DB → INSERT
    Returns: "inserted" | "updated" | "skipped" | "error"
    """
    try:
        existing = (
            db.table("aggregated_feed")
            .select("id, full_content_status")
            .eq("url", row["url"])
            .limit(1)
            .execute()
        )
        if existing.data:
            ex = existing.data[0]
            if ex.get("full_content_status") == "fetched":
                return "skipped"
            # Upgrade: fill in the missing full content
            db.table("aggregated_feed").update({
                "full_content": row["full_content"],
                "full_content_status": row["full_content_status"],
                "images": row["images"],
                "videos": row["videos"],
                "word_count": row["word_count"],
                "image_url": row["image_url"] or ex.get("image_url"),
            }).eq("id", ex["id"]).execute()
            return "updated"
        else:
            db.table("aggregated_feed").upsert(
                row, on_conflict="source,source_id"
            ).execute()
            return "inserted"
    except Exception as e:
        print(f"    ! DB error: {e}")
        return "error"


# ── fundus ───────────────────────────────────────────────────────────

def fetch_fundus(db) -> int:
    """
    Crawl major publishers via fundus.
    fundus has hand-written parsers for 171 publishers across 37 countries —
    highest extraction accuracy of any open-source tool (97.69% F1).
    """
    try:
        from fundus import Crawler, PublisherCollection  # type: ignore
    except ImportError:
        print("[fundus] not installed, skipping")
        return 0

    # Collect all available publisher collections
    collections = []
    for country_code in [
        "us", "gb", "de", "fr", "es", "pt", "it", "nl", "at", "ch",
        "au", "ca", "in", "ie", "nz", "sg",
        "jp", "kr", "cn",
        "ru", "pl", "cz", "hu", "ro",
        "se", "no", "dk", "fi",
        "be", "za", "mx", "ar", "br",
    ]:
        col = getattr(PublisherCollection, country_code, None)
        if col is not None:
            collections.append(col)

    if not collections:
        print("[fundus] no publisher collections found")
        return 0

    print(f"[fundus] crawling {len(collections)} country collections, max {MAX_FUNDUS_ARTICLES} articles")
    crawler = Crawler(*collections)
    inserted = 0
    updated = 0

    try:
        for article in crawler.crawl(max_articles=MAX_FUNDUS_ARTICLES):
            try:
                # fundus stores the URL on article.html.requested_url (not source_url)
                html_obj = getattr(article, "html", None)
                url = (
                    getattr(html_obj, "requested_url", None)
                    or getattr(html_obj, "responded_url", None)
                    or getattr(article, "url", None)
                    or getattr(article, "article_url", None)
                    or ""
                )
                url = str(url).strip()
                if not url:
                    continue

                # Publisher name
                pub = getattr(article, "publisher", None)
                source_name = str(pub).lower().replace(" ", "_") if pub else "fundus"

                source_id = url_hash(url)

                # Body text
                body_text = ""
                body_obj = getattr(article, "body", None)
                if body_obj is not None:
                    body_text = getattr(body_obj, "text", None) or str(body_obj) or ""

                # Images
                images: list[dict] = []
                for img in list(getattr(article, "images", None) or [])[:10]:
                    images.append({
                        "url": str(img.url),
                        "alt": str(getattr(img, "description", "") or ""),
                        "storage_path": "",
                        "width": None,
                        "height": None,
                    })

                # Author
                author: Optional[str] = None
                authors = getattr(article, "authors", None)
                if authors:
                    first = next(iter(authors), None)
                    if first:
                        author = getattr(first, "name", None) or str(first)

                # Language
                lang_raw = getattr(article, "language", None) or "en"
                lang = normalize_lang(str(lang_raw))

                # Published date
                pub_date_obj = getattr(article, "publishing_date", None)
                pub_date = pub_date_obj.isoformat() if pub_date_obj else datetime.now(timezone.utc).isoformat()

                row = {
                    "source": source_name,
                    "source_id": source_id,
                    "title": str(article.title) if article.title else None,
                    "content": body_text[:500] if body_text else None,
                    "url": url,
                    "image_url": images[0]["url"] if images else None,
                    "author_name": author,
                    "language": lang,
                    "published_at": pub_date,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                    "full_content": text_to_html(body_text) if body_text else None,
                    "full_content_status": "fetched" if len(body_text) > 100 else "failed",
                    "images": images,
                    "videos": [],
                    "word_count": len(body_text.split()) if body_text else 0,
                    "score": 0,
                    "tags": [],
                }

                result = upsert_article(db, row)
                title_short = (row["title"] or url)[:70]
                if result == "inserted":
                    inserted += 1
                    print(f"  + [{lang}] {title_short}")
                elif result == "updated":
                    updated += 1
                    print(f"  ↑ [{lang}] {title_short}")

            except Exception as e:
                print(f"  [fundus] article error: {e}")

    except Exception as e:
        print(f"[fundus] crawler error: {e}")

    print(f"[fundus] inserted={inserted} updated={updated}")
    return inserted + updated


# ── GDELT ────────────────────────────────────────────────────────────

def query_gdelt(query: str, lang_code: str, max_records: int = 20) -> list[dict]:
    """
    Query GDELT 2.0 Doc API.
    Free, no API key, updates every 15 minutes, covers 100+ languages.
    Returns article metadata including socialimage (open-graph quality).
    """
    try:
        resp = requests.get(
            "https://api.gdeltproject.org/api/v2/doc/doc",
            params={
                "query": f"{query} sourcelang:{lang_code}",
                "mode": "artlist",
                "format": "json",
                "maxrecords": max_records,
                "timespan": "2h",
                "sort": "DateDesc",
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("articles") or []
    except Exception as e:
        print(f"  [GDELT] query error for '{query[:40]}': {e}")
        return []


def extract_trafilatura(url: str) -> Optional[dict]:
    """
    Extract full article content from URL using trafilatura.
    Handles most sites without paywalls. Returns None on failure.
    """
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return None
        result = trafilatura.extract(
            downloaded,
            output_format="json",
            include_images=True,
            include_tables=False,
            no_fallback=False,
            favor_precision=True,
        )
        if not result:
            return None
        return json.loads(result)
    except Exception as e:
        print(f"  [trafilatura] {url[:60]}: {e}")
        return None


def fetch_gdelt(db) -> int:
    """
    Query GDELT for recent articles across topics and languages,
    then extract full content with trafilatura.
    """
    inserted = 0
    updated = 0

    for query, lang_code, tags in GDELT_QUERIES:
        print(f"  [GDELT] '{query[:45]}' [{lang_code}]")
        articles = query_gdelt(query, lang_code, MAX_GDELT_PER_QUERY)

        for art in articles:
            url = (art.get("url") or "").strip()
            if not url:
                continue

            domain = art.get("domain", "unknown")
            source_id = url_hash(url)

            # Quick pre-check: skip if already fetched (avoids expensive trafilatura call)
            try:
                existing = (
                    db.table("aggregated_feed")
                    .select("id, full_content_status")
                    .eq("url", url)
                    .limit(1)
                    .execute()
                )
                if existing.data and existing.data[0].get("full_content_status") == "fetched":
                    continue
            except Exception:
                pass

            # Extract full text
            extracted = extract_trafilatura(url)
            body_text = (extracted or {}).get("text", "") or ""

            # Parse GDELT date: "20260306T120000Z"
            seen = art.get("seendate", "")
            try:
                pub_date = datetime.strptime(seen, "%Y%m%dT%H%M%SZ").replace(
                    tzinfo=timezone.utc
                ).isoformat()
            except Exception:
                pub_date = datetime.now(timezone.utc).isoformat()

            lang_raw = art.get("language", lang_code)
            lang = normalize_lang(lang_raw)

            title = art.get("title") or (extracted or {}).get("title")
            # GDELT socialimage is the article's open-graph image — often high quality
            image_url = art.get("socialimage") or (extracted or {}).get("image")
            author = (extracted or {}).get("author")

            row = {
                "source": domain,
                "source_id": source_id,
                "title": title,
                "content": body_text[:500] if body_text else None,
                "url": url,
                "image_url": image_url,
                "author_name": author,
                "language": lang,
                "published_at": pub_date,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "full_content": text_to_html(body_text) if body_text else None,
                "full_content_status": "fetched" if len(body_text) > 100 else "failed",
                "images": [],
                "videos": [],
                "word_count": len(body_text.split()) if body_text else 0,
                "score": 0,
                "tags": tags,
            }

            result = upsert_article(db, row)
            title_short = (title or url)[:70]
            if result == "inserted":
                inserted += 1
                print(f"    + [{lang}] {title_short}")
            elif result == "updated":
                updated += 1
                print(f"    ↑ [{lang}] {title_short}")

        # Rate-limit: GDELT returns 429 if queried too fast
        time.sleep(4)

    print(f"[GDELT] inserted={inserted} updated={updated}")
    return inserted + updated


# ── Main ─────────────────────────────────────────────────────────────

def main() -> None:
    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    total = 0
    t0 = time.time()

    if SOURCE_ARG in ("fundus", "both"):
        print("\n=== fundus: crawling major publishers ===")
        n = fetch_fundus(db)
        print(f"fundus: {n} articles inserted\n")
        total += n

    if SOURCE_ARG in ("gdelt", "both"):
        print("=== GDELT + trafilatura: supplementary coverage ===")
        n = fetch_gdelt(db)
        print(f"GDELT: {n} articles inserted\n")
        total += n

    elapsed = round(time.time() - t0, 1)
    print(f"=== Total: {total} new articles in {elapsed}s ===")


if __name__ == "__main__":
    main()
