# 23 — 消息聚合层

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 23.1 概述

Bill.ai 消息 Tab 采用 **聚合 + 原生** 双模式：
- **原生聊天**：平台内置的私聊/群聊（已有，基于 Supabase Realtime）
- **聚合聊天**：通过协议库桥接外部平台（Telegram、WhatsApp、Discord 等），统一展示

### 核心理念

用户只需一个 App（Bill.ai），即可收发所有平台的消息。类似 Beeper / Matrix Bridge 模式，但集成在 Bill.ai 平台内部。

---

## 23.2 架构

```
┌───────────────────────────────────────────┐
│ Bill.ai 前端（消息 Tab）                    │
│                                           │
│ [全部] [平台] [WhatsApp] [Telegram] [...]  │
│                                           │
│ 统一消息列表（统一 UI，标注来源平台）         │
└──────────────┬────────────────────────────┘
               │ Supabase Realtime / WebSocket
┌──────────────▼────────────────────────────┐
│ 消息聚合服务（MessageBridge）               │
│                                           │
│ ├── NativeBridge                          │
│ │   └── Supabase Realtime（现有聊天系统）   │
│ │                                         │
│ ├── TelegramBridge (gramjs)               │
│ │   └── MTProto 长连接                     │
│ │   └── 认证方式：手机号 + 验证码           │
│ │                                         │
│ ├── WhatsAppBridge (Baileys)              │
│ │   └── WhatsApp Web 协议                  │
│ │   └── 认证方式：扫码（QR）               │
│ │                                         │
│ ├── DiscordBridge (discord.js)            │
│ │   └── Gateway WebSocket                 │
│ │   └── 认证方式：OAuth2                   │
│ │                                         │
│ └── 更多（Signal, Slack, Email...）        │
│                                           │
│ 统一消息格式 → 写入 DB → 推送前端           │
└───────────────────────────────────────────┘
```

---

## 23.3 平台开放度评估

### 可接入（官方支持或完全开放）

| 平台 | 协议库 | 认证方式 | 风险 |
|------|--------|---------|------|
| **Telegram** | gramjs (JS MTProto) | 手机号+验证码 | 零（官方支持第三方客户端） |
| **Discord** | discord.js | OAuth2 | 低（Bot 合规） |
| **Slack** | @slack/web-api | OAuth2 | 低 |
| **Matrix/Element** | matrix-js-sdk | 用户名+密码 | 零（开放协议） |
| **Email** | IMAP/SMTP 标准 | 邮箱+密码/OAuth | 零 |

### 有限接入（非官方协议，有风险）

| 平台 | 协议库 | 认证方式 | 风险 |
|------|--------|---------|------|
| **WhatsApp** | Baileys (JS) | 扫码 | 中（ToS 禁止，但 Beeper 运营多年） |
| **Signal** | libsignal | 手机号 | 中（官方不鼓励第三方） |

### 不可接入

| 平台 | 原因 |
|------|------|
| 微信 | 完全封闭，无公共 API |
| iMessage | Apple 封闭生态 |
| LINE | 仅 Bot API，无消费端 |

---

## 23.4 统一消息格式

```typescript
interface AggregatedMessage {
  id: string;                    // Bill.ai 内部 ID
  platform: 'native' | 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'email';
  platform_chat_id: string;      // 原平台的会话 ID
  platform_message_id: string;   // 原平台的消息 ID
  sender: {
    name: string;
    avatar_url: string | null;
    platform_user_id: string;    // 原平台的用户标识
  };
  content: {
    type: 'text' | 'image' | 'file' | 'voice' | 'video' | 'sticker';
    text?: string;
    media_url?: string;
    file_name?: string;
    file_size?: number;
  };
  reply_to?: string;             // 引用消息 ID
  timestamp: string;             // ISO 8601
  is_outgoing: boolean;          // 是否是自己发的
}

interface AggregatedChat {
  id: string;
  platform: string;
  name: string;                  // 联系人/群组名
  avatar_url: string | null;
  last_message: AggregatedMessage | null;
  unread_count: number;
  is_group: boolean;
  is_muted: boolean;
}
```

---

## 23.5 数据库设计

```sql
-- 用户连接的外部平台账号
CREATE TABLE message_bridges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,  -- 'telegram', 'whatsapp', 'discord', ...
  credentials JSONB NOT NULL, -- 加密存储的认证凭据（session string 等）
  status      TEXT NOT NULL DEFAULT 'connected',  -- connected, disconnected, error
  display_name TEXT,          -- 平台上的用户名
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  UNIQUE(user_id, platform)
);

-- 聚合消息缓存（最近消息，不做永久存储）
CREATE TABLE aggregated_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL,
  platform_chat_id    TEXT NOT NULL,
  platform_message_id TEXT NOT NULL,
  sender_name         TEXT,
  sender_avatar       TEXT,
  content_type        TEXT NOT NULL DEFAULT 'text',
  content_text        TEXT,
  content_media_url   TEXT,
  is_outgoing         BOOLEAN DEFAULT false,
  timestamp           TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform, platform_message_id)
);

CREATE INDEX idx_agg_msg_user_chat
  ON aggregated_messages(user_id, platform, platform_chat_id, timestamp DESC);

-- 聚合会话列表
CREATE TABLE aggregated_chats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  platform_chat_id TEXT NOT NULL,
  name            TEXT,
  avatar_url      TEXT,
  is_group        BOOLEAN DEFAULT false,
  is_muted        BOOLEAN DEFAULT false,
  unread_count    INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  UNIQUE(user_id, platform, platform_chat_id)
);
```

---

## 23.6 后端服务设计

### 部署方式

消息桥接需要 **长连接常驻进程**，不适合 Supabase Edge Function（无状态、短生命周期）。

推荐方案：
- **独立 Node.js 服务**（部署在 Fly.io / Railway / 自有 VPS）
- 通过 Supabase Service Role Key 写入 DB
- 通过 Supabase Realtime 推送到前端

```
Node.js 消息桥接服务
├── 每个用户的每个平台 = 一个 Bridge 实例
├── 连接管理器：维护连接池，断线重连
├── 消息处理器：标准化消息格式，写入 DB
└── 推送层：通过 Supabase Realtime Channel 通知前端
```

### 资源估算

| 用户数 | 平台连接数 | 内存估算 | 部署建议 |
|--------|-----------|---------|---------|
| 100 | ~200 | ~500MB | 单台 1GB VPS |
| 1,000 | ~2,000 | ~4GB | 2-4 台 2GB |
| 10,000 | ~20,000 | ~40GB | 集群 + 连接分片 |

---

## 23.7 实施路径

### 第一步：Telegram 桥接 MVP

选择 Telegram 作为第一个桥接目标（零法律风险，协议完全开放）：

1. 部署 Node.js 桥接服务
2. 用户在 Bill.ai 设置中添加 Telegram 账号（手机号 → 验证码）
3. gramjs 建立 MTProto 连接
4. 同步最近 50 条消息到 `aggregated_messages`
5. 实时监听新消息，写入 DB + 推送前端
6. 前端消息 Tab 显示 Telegram 消息（带 Telegram 图标标识）
7. 支持从 Bill.ai 回复（通过桥接服务转发）

### 第二步：WhatsApp 桥接

1. Baileys 扫码认证
2. 同步聊天列表 + 最近消息
3. 实时收发

### 第三步：更多平台 + 统一通知

---

## 23.8 安全考量

| 项目 | 措施 |
|------|------|
| 凭据存储 | `credentials` 字段使用 AES-256 加密，密钥存环境变量，不落明文 |
| 数据隔离 | RLS 确保用户只能访问自己的消息和桥接配置 |
| 消息保留 | 聚合消息默认只缓存最近 30 天，用户可手动清除 |
| 用户告知 | 接入 WhatsApp 等非官方桥接时，明确告知风险（可能导致原平台封号） |
| 断开连接 | 用户可随时断开任何平台连接，立即删除所有缓存消息和凭据 |
