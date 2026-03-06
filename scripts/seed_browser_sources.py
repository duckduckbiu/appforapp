#!/usr/bin/env python3
"""Seed browser_use sources into feed_sources table."""
import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

db = create_client(SUPABASE_URL, SUPABASE_KEY)

sources = [
    {
        "name": "新浪新闻",
        "source_type": "browser_use",
        "source_url": "https://news.sina.com.cn/",
        "category": "news",
        "language": "zh-CN",
        "is_active": True,
        "fetch_interval_minutes": 120,
        "description": "新浪新闻首页",
    },
    {
        "name": "腾讯新闻",
        "source_type": "browser_use",
        "source_url": "https://news.qq.com/",
        "category": "news",
        "language": "zh-CN",
        "is_active": True,
        "fetch_interval_minutes": 120,
        "description": "腾讯新闻首页",
    },
    {
        "name": "BBC News",
        "source_type": "browser_use",
        "source_url": "https://www.bbc.com/news",
        "category": "news",
        "language": "en",
        "is_active": True,
        "fetch_interval_minutes": 120,
        "description": "BBC News homepage",
    },
    {
        "name": "Reuters",
        "source_type": "browser_use",
        "source_url": "https://www.reuters.com/",
        "category": "news",
        "language": "en",
        "is_active": True,
        "fetch_interval_minutes": 120,
        "description": "Reuters homepage",
    },
]

# Check if already seeded
existing = db.table("feed_sources").select("name").eq("source_type", "browser_use").execute()
if existing.data:
    print(f"Already have {len(existing.data)} browser_use sources, skipping seed.")
    for s in existing.data:
        print(f"  - {s['name']}")
else:
    result = db.table("feed_sources").insert(sources).execute()
    print(f"Inserted {len(result.data)} browser_use sources:")
    for s in result.data:
        print(f"  + {s['name']} ({s['language']}) - {s['source_url']}")
