# 24 — 动态聚合层

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 24.1 概述

Bill.ai 动态 Tab 采用 **被动（聚合公开内容）+ 主动（用户原创 UGC）** 双模式：

- **被动**：自动抓取国际公开内容（新闻、科技、社区帖子），无需登录即可浏览
- **主动**：用户发帖、评论、点赞等互动行为，需要登录

### 解决的核心问题

**冷启动**：新平台没有用户 = 没有内容 = 留不住人。通过聚合公开内容，打开动态 Tab 就有丰富的信息流，用户不会看到空白页面。

### 演变路径

```
Phase 1（0 用户）    → 100% 聚合内容
Phase 2（100+ 用户） → 80% 聚合 + 20% UGC
Phase 3（1000+ 用户）→ 50% 聚合 + 50% UGC
Phase 4（成熟）      → 20% 聚合（新闻频道） + 80% UGC
```

---

## 24.2 内容来源

### 免费公开源

| 来源 | API/方式 | 内容类型 | 频率 | 费用 |
|------|---------|---------|------|------|
| **RSS Feeds** | 标准 XML 协议 | 新闻、博客、播客 | 15 分钟 | 免费 |
| **Hacker News** | `https://hacker-news.firebaseio.com/v0/` | 科技资讯 | 1 小时 | 免费 |
| **Reddit** | `https://www.reddit.com/r/{sub}.json` | 社区讨论 | 1 小时 | 免费（100 次/分） |
| **Mastodon** | ActivityPub 公开 API | 社交帖子 | 30 分钟 | 免费 |
| **GitHub Trending** | 页面抓取或第三方 API | 开源项目 | 6 小时 | 免费 |
| **Telegram 公开频道** | Bot API | 频道帖子 | 实时 | 免费 |

### 付费源（按需接入）

| 来源 | API | 费用 | 备注 |
|------|-----|------|------|
| **NewsAPI.org** | REST | 免费 100 次/天，$449/月 | 全球新闻聚合 |
| **GNews** | REST | 免费 100 次/天，$84/月 | 多语言新闻 |
| **YouTube Data API** | REST | 免费 10,000 单位/天 | 热门视频 |

### 推荐初期 RSS 订阅列表

```
# 科技
https://feeds.arstechnica.com/arstechnica/index
https://www.theverge.com/rss/index.xml
https://techcrunch.com/feed/

# 国际新闻
https://feeds.bbci.co.uk/news/world/rss.xml
https://rss.nytimes.com/services/xml/rss/nyt/World.xml

# 中文科技
https://www.36kr.com/feed
https://sspai.com/feed

# 加密/Web3
https://www.coindesk.com/arc/outboundfeeds/rss/

# 开源/开发
https://github.blog/feed/
https://dev.to/feed
```

---

## 24.3 架构

```
┌───────────────────────────────────────────┐
│ Bill.ai 前端（动态 Tab）                    │
│                                           │
│ [推荐] [科技] [财经] [娱乐] [关注]          │
│                                           │
│ 混合 Feed：聚合内容 + 原生 UGC              │
│ （按时间或推荐算法混排）                     │
│                                           │
│ 未登录：可浏览，互动按钮提示登录             │
│ 已登录：完整互动 + 个性化推荐               │
└──────────────┬────────────────────────────┘
               │ API 查询
┌──────────────▼────────────────────────────┐
│ Feed API（Supabase Edge Function / RPC）   │
│                                           │
│ SELECT * FROM (                           │
│   SELECT ... FROM aggregated_feed         │
│   UNION ALL                               │
│   SELECT ... FROM posts (原生 UGC)        │
│ ) ORDER BY score DESC, published_at DESC  │
│ LIMIT 20 OFFSET ?                         │
└──────────────┬────────────────────────────┘
               │
┌──────────────▼────────────────────────────┐
│ 内容抓取服务（Cron / 定时任务）             │
│                                           │
│ ├── RSSFetcher                            │
│ │   └── 解析 RSS XML → 标准化 → 写入 DB   │
│ │                                         │
│ ├── HackerNewsFetcher                     │
│ │   └── Top/Best Stories API → 写入 DB    │
│ │                                         │
│ ├── RedditFetcher                         │
│ │   └── Subreddit JSON → 写入 DB          │
│ │                                         │
│ └── 去重 + 分类 + 摘要提取                  │
└───────────────────────────────────────────┘
```

---

## 24.4 统一内容格式

```typescript
interface FeedItem {
  id: string;
  type: 'aggregated' | 'native';    // 聚合 vs 原生 UGC

  // 来源信息
  source: {
    platform: string;               // 'rss', 'hackernews', 'reddit', 'mastodon', 'native'
    name: string;                   // 'BBC News', 'r/technology', '张三'
    icon_url: string | null;        // 来源图标
    url: string | null;             // 原文链接
  };

  // 内容
  title: string | null;             // 标题（新闻有，UGC 可能没有）
  summary: string;                  // 摘要/正文
  image_url: string | null;         // 封面图
  media_type: 'article' | 'image' | 'video' | 'link' | 'text';

  // 元数据
  category: string;                 // 'tech', 'news', 'finance', 'entertainment', 'general'
  language: string;                 // 'en', 'zh', 'ja', ...
  published_at: string;             // ISO 8601

  // 平台内互动（聚合内容也可以在 Bill.ai 内评论/点赞）
  stats: {
    likes: number;                  // Bill.ai 内的点赞数
    comments: number;               // Bill.ai 内的评论数
    shares: number;
    original_score?: number;        // 原平台热度（HN points, Reddit upvotes）
  };
}
```

---

## 24.5 数据库设计

```sql
-- 聚合内容表
CREATE TABLE aggregated_feed (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL,         -- 'rss', 'hackernews', 'reddit', 'mastodon'
  source_name   TEXT NOT NULL,         -- 'BBC News', 'r/technology'
  source_url    TEXT,                  -- 原文链接
  source_id     TEXT,                  -- 原平台的唯一 ID（去重用）
  title         TEXT,
  summary       TEXT,
  image_url     TEXT,
  media_type    TEXT DEFAULT 'article',
  category      TEXT DEFAULT 'general',
  language      TEXT DEFAULT 'en',
  original_score INT DEFAULT 0,        -- 原平台热度
  published_at  TIMESTAMPTZ NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source, source_id)            -- 防止重复抓取
);

CREATE INDEX idx_agg_feed_category_time
  ON aggregated_feed(category, published_at DESC);
CREATE INDEX idx_agg_feed_published
  ON aggregated_feed(published_at DESC);

-- Bill.ai 用户对聚合内容的互动
CREATE TABLE feed_interactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_item_id  UUID NOT NULL REFERENCES aggregated_feed(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,          -- 'like', 'bookmark', 'share'
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, feed_item_id, type)
);

-- 聚合内容的评论（复用现有 comments 表结构，或新建）
CREATE TABLE feed_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id  UUID NOT NULL REFERENCES aggregated_feed(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  parent_id     UUID REFERENCES feed_comments(id),  -- 嵌套回复
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RSS 订阅源管理
CREATE TABLE feed_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,           -- 'rss', 'hackernews', 'reddit', 'mastodon'
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,           -- RSS URL 或 API endpoint
  category    TEXT DEFAULT 'general',
  language    TEXT DEFAULT 'en',
  icon_url    TEXT,
  is_active   BOOLEAN DEFAULT true,
  fetch_interval_minutes INT DEFAULT 60,
  last_fetched_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 24.6 内容抓取服务

### 部署方式

与消息桥接不同，内容抓取不需要长连接，**适合 Cron 定时任务**：

**方案 A**（推荐初期）：Supabase Edge Function + pg_cron
```sql
-- 每 15 分钟触发 RSS 抓取
SELECT cron.schedule(
  'fetch-rss-feeds',
  '*/15 * * * *',
  $$ SELECT net.http_post('https://<project>.supabase.co/functions/v1/fetch-feeds', '{}') $$
);
```

**方案 B**（规模化后）：独立 Node.js 服务 + 定时调度

### 抓取逻辑伪代码

```typescript
// Edge Function: fetch-feeds
async function fetchFeeds() {
  const sources = await supabase
    .from('feed_sources')
    .select('*')
    .eq('is_active', true)
    .lt('last_fetched_at', new Date(Date.now() - intervalMs));

  for (const source of sources) {
    switch (source.type) {
      case 'rss':
        await fetchRSS(source);
        break;
      case 'hackernews':
        await fetchHN(source);
        break;
      case 'reddit':
        await fetchReddit(source);
        break;
    }
  }
}

async function fetchRSS(source: FeedSource) {
  const xml = await fetch(source.url).then(r => r.text());
  const items = parseRSSXML(xml);     // 用 fast-xml-parser 等库

  const normalized = items.map(item => ({
    source: 'rss',
    source_name: source.name,
    source_url: item.link,
    source_id: item.guid || item.link, // 去重 key
    title: item.title,
    summary: stripHTML(item.description).slice(0, 500),
    image_url: extractImage(item),
    category: source.category,
    language: source.language,
    published_at: item.pubDate,
  }));

  await supabase
    .from('aggregated_feed')
    .upsert(normalized, { onConflict: 'source,source_id' });

  await supabase
    .from('feed_sources')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('id', source.id);
}
```

---

## 24.7 前端 Feed API

```typescript
// 混合查询：聚合内容 + 原生 UGC
async function getFeed(params: {
  category?: string;
  cursor?: string;
  limit?: number;
  userId?: string;    // 已登录用户（个性化）
}) {
  // 方案：用 Supabase RPC 做 UNION 查询
  const { data } = await supabase.rpc('get_mixed_feed', {
    p_category: params.category || null,
    p_cursor: params.cursor || null,
    p_limit: params.limit || 20,
  });
  return data;
}
```

```sql
-- RPC function: get_mixed_feed
CREATE OR REPLACE FUNCTION get_mixed_feed(
  p_category TEXT DEFAULT NULL,
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID, type TEXT, source TEXT, source_name TEXT,
  source_url TEXT, title TEXT, summary TEXT,
  image_url TEXT, category TEXT, published_at TIMESTAMPTZ,
  like_count BIGINT, comment_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  (
    -- 聚合内容
    SELECT
      af.id, 'aggregated'::TEXT as type, af.source, af.source_name,
      af.source_url, af.title, af.summary,
      af.image_url, af.category, af.published_at,
      COALESCE(fi.likes, 0) as like_count,
      COALESCE(fc.cnt, 0) as comment_count
    FROM aggregated_feed af
    LEFT JOIN (
      SELECT feed_item_id, COUNT(*) as likes
      FROM feed_interactions WHERE type = 'like'
      GROUP BY feed_item_id
    ) fi ON fi.feed_item_id = af.id
    LEFT JOIN (
      SELECT feed_item_id, COUNT(*) as cnt
      FROM feed_comments
      GROUP BY feed_item_id
    ) fc ON fc.feed_item_id = af.id
    WHERE (p_category IS NULL OR af.category = p_category)
      AND (p_cursor IS NULL OR af.published_at < p_cursor)

    UNION ALL

    -- 原生 UGC
    SELECT
      p.id, 'native'::TEXT, 'native', pr.display_name,
      NULL, NULL, p.content,
      p.image_url, 'general', p.created_at,
      COALESCE(p.likes_count, 0),
      COALESCE(p.comments_count, 0)
    FROM posts p
    JOIN profiles pr ON pr.id = p.user_id
    WHERE p.visibility = 'public'
      AND (p_category IS NULL OR p_category = 'general')
      AND (p_cursor IS NULL OR p.created_at < p_cursor)
  )
  ORDER BY published_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 24.8 互动权限

| 操作 | 未登录 | 已登录 |
|------|--------|--------|
| 浏览动态 | ✅ | ✅ |
| 查看详情/原文 | ✅ | ✅ |
| 点赞 | ❌ 提示登录 | ✅ |
| 评论 | ❌ 提示登录 | ✅ |
| 分享 | ✅ 生成链接 | ✅ |
| 收藏 | ❌ 提示登录 | ✅ |
| 发帖（UGC） | ❌ 提示登录 | ✅ |
| 个性化推荐 | ❌ 默认热门 | ✅ 兴趣算法 |

---

## 24.9 内容清理策略

```sql
-- 每天清理 30 天前的聚合内容（无互动的）
-- 有点赞/评论的保留更久（90 天）
DELETE FROM aggregated_feed
WHERE fetched_at < now() - INTERVAL '30 days'
  AND id NOT IN (
    SELECT DISTINCT feed_item_id FROM feed_interactions
    UNION
    SELECT DISTINCT feed_item_id FROM feed_comments
  );
```

---

## 24.10 实施路径

### 第一步：RSS 抓取 + 混合 Feed

1. 创建 `feed_sources` 表，预置 10-20 个 RSS 源（中英文各半）
2. 实现 Edge Function `fetch-feeds`，支持 RSS 解析
3. 设置 pg_cron 每 15 分钟触发
4. 修改前端动态 Tab，混合显示 `aggregated_feed` + `posts`
5. 未登录用户可直接浏览

### 第二步：Hacker News + Reddit

1. 新增 HN/Reddit fetcher
2. 分类标签优化
3. 原文预览（内嵌 WebView 或摘要展开）

### 第三步：个性化推荐

1. 记录用户互动行为（点赞、停留时间、分类偏好）
2. 简单推荐算法（基于分类权重 + 热度衰减）
3. "关注" Tab 显示关注用户的 UGC

### 第四步：用户自定义订阅源

1. 用户可添加自己的 RSS 源
2. 关注 Telegram 公开频道
3. 个人 Feed 完全定制化
