# 09 — 存储服务

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 9.1 存储分层策略

```
Bill.ai 平台的存储需求分为三层:

  小文件（头像、图标、缩略图）
    ├── 大小: < 10 MB
    ├── 存储: Supabase Storage（平台已有）
    └── 适用: 用户头像、应用图标、帖子图片

  中等文件（图片、文档、音频）
    ├── 大小: 10 MB - 100 MB
    ├── 存储: Cloudflare R2
    └── 适用: 高清图片、PDF、短音频

  大文件（视频、大型媒体）
    ├── 大小: 100 MB - 10 GB
    ├── 存储: Cloudflare R2 + Cloudflare Stream（视频转码）
    └── 适用: 视频内容、直播回放
```

## 9.2 为什么选 Cloudflare R2？

| 服务 | 存储 (/TB/月) | 流出流量 (/TB) | 全球 CDN | S3 兼容 |
|------|-------------|--------------|---------|---------|
| **Cloudflare R2** ✅ | $15 | **$0** | ✅ 自带 | ✅ |
| Backblaze B2 | $6 | $10 (配 CF 免费) | 需配 CF | ✅ |
| AWS S3 | $23 | $90 | 需配 CloudFront | ✅ |
| Supabase Storage | 包含套餐 | 有限额 | ❌ | ❌ |

**选择 R2 的原因**：
- 视频平台最大成本是流出流量，R2 流出 = $0
- 自带 Cloudflare CDN，全球加速
- S3 兼容 API，迁移成本低
- 一站式方案，不需要额外配 CDN

**备选方案**：如果存储成本敏感（视频量极大），可以用 Backblaze B2 + Cloudflare CDN 组合（存储 $6/TB，比 R2 的 $15 更便宜）。

## 9.3 平台存储架构

```
┌─ Bill.ai 存储层 ──────────────────────────────────┐
│                                                    │
│  Supabase Storage（小文件 < 10MB）                  │
│  ├── avatars/          用户头像                     │
│  ├── app-icons/        应用图标                     │
│  └── thumbnails/       缩略图                       │
│                                                    │
│  Cloudflare R2（中大文件）                           │
│  ├── platform/                                     │
│  │   ├── posts/{postId}/    帖子媒体               │
│  │   ├── messages/{msgId}/  聊天媒体               │
│  │   └── channels/{chId}/   频道媒体               │
│  │                                                 │
│  ├── apps/{appId}/          ← 按应用隔离           │
│  │   ├── users/{userId}/    用户上传               │
│  │   ├── shared/            应用公共资源            │
│  │   └── data/              应用数据文件            │
│  │                                                 │
│  └── videos/                ← 视频专区             │
│      ├── raw/{videoId}      原始文件               │
│      ├── transcoded/        转码后的多码率版本      │
│      └── thumbnails/        视频缩略图             │
│                                                    │
│  访问控制:                                          │
│  ├── 公开文件 → Cloudflare CDN 直接访问             │
│  ├── 私有文件 → 签名 URL（有效期 1h）               │
│  └── 应用隔离 → apps/{appId}/ 下的文件只有该应用能访问│
└────────────────────────────────────────────────────┘
```

## 9.4 SDK 存储接口

### 应用开发者的视角

```typescript
// 上传文件
const result = await billai.storage.uploadFile({
  file: videoFile,
  path: 'videos/my-video.mp4',
  preset: 'video',               // 自动触发转码
});
console.log(result.url);         // CDN URL
console.log(result.fileId);      // 文件 ID

// 获取文件信息
const info = await billai.storage.getFileInfo(fileId);

// 删除文件
await billai.storage.deleteFile(fileId);

// 查看存储用量
const usage = await billai.storage.getUsage();
// { used: 5_368_709_120, quota: 10_737_418_240 }  // 5GB / 10GB

// 列出文件
const files = await billai.storage.listFiles({
  path: 'videos/',
  limit: 20,
});
```

### 上传预设 (Presets)

```
preset: 'avatar'
  → 自动压缩到 256x256, WebP 格式, < 100KB
  → 存储到 Supabase Storage

preset: 'post'
  → 自动压缩, 最大 1920px 宽, WebP/JPEG
  → 存储到 R2

preset: 'message'
  → 自动压缩, 最大 1280px 宽
  → 存储到 R2

preset: 'video'
  → 原始文件上传到 R2
  → 触发转码任务（360p, 720p, 1080p）
  → 生成缩略图
  → 返回 HLS 播放地址
```

## 9.5 视频处理流水线

```
用户上传视频
  → 前端分片上传（支持断点续传）
  → 原始文件存入 R2 videos/raw/
  → 触发转码任务:
      ├── Cloudflare Stream（推荐，自动转码 + HLS）
      │   $1/1000分钟存储 + $1/1000分钟播放
      │
      └── 或自建 FFmpeg 转码（成本更低但需维护）
          ├── 360p (640x360)
          ├── 720p (1280x720)
          └── 1080p (1920x1080)
  → 转码完成 → 生成缩略图
  → 更新文件记录状态为 'ready'
  → 通知应用（通过 SDK 事件）
```

## 9.6 应用存储配额管理

```
开发者的存储配额（根据开发者订阅等级）:

  免费开发者:
    ├── 应用存储: 1 GB
    ├── 单文件大小: 25 MB
    └── 视频: 不支持

  Dev Pro ($29/月):
    ├── 应用存储: 50 GB
    ├── 单文件大小: 100 MB
    └── 视频: 最长 10 分钟

  Dev Enterprise ($99/月):
    ├── 应用存储: 500 GB
    ├── 单文件大小: 500 MB
    └── 视频: 最长 60 分钟

  超额:
    ├── 存储超额: $0.02/GB/月
    └── 视频超额: 按 Cloudflare Stream 费率
```

### 用户的存储配额（根据平台订阅等级）

```
免费用户:      1 GB
Bill.ai Pro:  10 GB
Bill.ai Max: 100 GB
```

## 9.7 数据库表

```sql
-- 文件记录
CREATE TABLE storage_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES profiles(id) NOT NULL,
  app_id TEXT,                          -- 关联应用（NULL = 平台级文件）
  storage_backend TEXT NOT NULL,        -- 'supabase' | 'r2' | 'cf_stream'
  bucket TEXT NOT NULL,                 -- 存储桶名
  path TEXT NOT NULL,                   -- 文件路径
  filename TEXT NOT NULL,               -- 原始文件名
  content_type TEXT NOT NULL,           -- MIME 类型
  size BIGINT NOT NULL,                 -- 文件大小（字节）
  url TEXT,                             -- CDN 访问 URL
  is_public BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',          -- 额外信息（宽高、时长等）
  status TEXT DEFAULT 'ready',          -- 'uploading' | 'processing' | 'ready' | 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 应用存储用量汇总
CREATE TABLE app_storage_usage (
  app_id TEXT PRIMARY KEY,
  total_size BIGINT DEFAULT 0,          -- 总用量（字节）
  file_count INTEGER DEFAULT 0,
  quota BIGINT NOT NULL,                -- 配额（字节）
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户存储用量汇总
CREATE TABLE user_storage_usage (
  user_id UUID REFERENCES profiles(id) PRIMARY KEY,
  total_size BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  quota BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 9.8 Phase 规划

| 功能 | Phase 0 | Phase 1 | Phase 2 | Phase 3+ |
|------|---------|---------|---------|----------|
| Supabase 小文件存储 | ✅ 已有 | ✅ | ✅ | ✅ |
| Cloudflare R2 配置 | — | ✅ 配置好 | ✅ | ✅ |
| SDK storage 模块 | — | ✅ upload + get | ✅ 完善 | ✅ |
| 上传预设（压缩） | — | ✅ avatar + post | ✅ + video | ✅ |
| 应用存储隔离 | — | ✅ | ✅ | ✅ |
| 配额管理 | — | ✅ 硬限制 | ✅ + 超额计费 | ✅ |
| 视频上传 | — | — | ✅ 基础版 | ✅ + 转码 |
| Cloudflare Stream | — | — | — | ✅ |
