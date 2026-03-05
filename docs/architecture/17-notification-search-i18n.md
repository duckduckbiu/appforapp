# 17 — 通知系统 · 搜索系统 · 国际化 · API 版本控制

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。
> 这四个系统的共同特点：**不提前设计，后改极痛。**

---

## 17.1 通知系统

### 为什么必须第一天设计

几乎所有功能都需要发通知。如果各模块各自实现通知，后果是：
- 通知格式不统一
- 用户偏好无法统一管理
- 通知频率失控（每个模块都在骚扰用户）
- 后期整合要改几十个文件

### 四种通知渠道

```
┌─────────────────────────────────────────────┐
│              通知系统                         │
├─────────────────────────────────────────────┤
│                                             │
│  ① 应用内实时通知（Supabase Realtime）        │
│     → 小红点 + 通知列表 + 灵动岛弹窗          │
│     → 用户在线时即时推送                      │
│                                             │
│  ② Push 推送（FCM + APNs）                   │
│     → 用户离线时推送到手机                     │
│     → Phase 4（App Store 上架后）             │
│                                             │
│  ③ 邮件通知                                  │
│     → 重要事件（收入到账、审核结果、安全告警）   │
│     → Phase 2-3                             │
│                                             │
│  ④ SMS（可选）                               │
│     → 仅用于安全验证（2FA、异常登录）           │
│     → Phase 4+                              │
│                                             │
└─────────────────────────────────────────────┘
```

### 统一事件格式

所有通知由**统一管道**处理，任何模块只需提交一个事件：

```typescript
interface NotificationEvent {
  // 谁触发的
  actorId: string;            // 触发者用户 ID
  actorType: 'user' | 'system' | 'app';

  // 通知什么
  type: string;               // 事件类型（见下方枚举）
  category: string;           // 分类（social / finance / app / system）

  // 通知谁
  recipientId: string;        // 接收者用户 ID

  // 内容
  title: string;              // 标题（支持 i18n key）
  body: string;               // 正文（支持 i18n key）
  data: Record<string, any>;  // 附加数据（用于模板渲染和跳转）

  // 跳转
  actionUrl?: string;         // 点击后跳转的路由

  // 渠道控制
  channels: ('in_app' | 'push' | 'email' | 'sms')[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
}
```

### 通知类型枚举

| 分类 | 类型 | 示例 | 默认渠道 |
|------|------|------|---------|
| **社交** | `social.follow` | "张三关注了你" | in_app |
| | `social.like` | "张三赞了你的帖子" | in_app |
| | `social.comment` | "张三评论了你的帖子" | in_app |
| | `social.mention` | "张三在评论中@了你" | in_app + push |
| **聊天** | `chat.message` | "张三发了一条消息" | in_app + push |
| | `chat.group_invite` | "张三邀请你加入群组" | in_app |
| **应用** | `app.review` | "你的应用收到新评价" | in_app + email |
| | `app.review_reply` | "开发者回复了你的评价" | in_app |
| | `app.install` | "你的应用被安装了" | in_app |
| | `app.approved` | "你的应用审核通过" | in_app + email |
| | `app.rejected` | "你的应用审核未通过" | in_app + email |
| **频道** | `channel.join` | "张三加入了你的频道" | in_app |
| | `channel.app_added` | "频道安装了新应用" | in_app |
| **财务** | `finance.income` | "你有一笔新收入 $5.00" | in_app + email |
| | `finance.withdrawal` | "提现已到账" | in_app + email |
| | `finance.subscription` | "订阅即将到期" | in_app + email + push |
| **推广** | `promo.referral` | "你推广的用户已注册" | in_app |
| | `promo.commission` | "你获得推广佣金 $1.00" | in_app |
| **系统** | `system.security` | "新设备登录你的账号" | in_app + email + push |
| | `system.ban` | "你的账号被限制" | in_app + email |
| | `system.announcement` | "平台公告" | in_app + push |

### 通知聚合

防止通知泛滥。相同类型的通知在短时间内聚合：

```
规则:
  同类通知 5 分钟内 ≤ 3 条 → 逐条显示
  同类通知 5 分钟内 > 3 条 → 聚合为 "张三等 X 人赞了你的帖子"

聚合粒度:
  social.like  → 按 target 聚合（同一帖子的赞合并）
  social.follow → 按 recipient 聚合（关注合并）
  chat.message → 按 conversation 聚合（同一对话合并）
  finance.*    → 不聚合（每笔都重要）
```

### 用户偏好设置

用户可以在设置中控制每种通知的开关：

```typescript
interface NotificationPreferences {
  // 按分类大开关
  social: boolean;        // 社交通知总开关
  chat: boolean;          // 聊天通知
  finance: boolean;       // 财务通知（不允许关闭）
  system: boolean;        // 系统通知（不允许关闭）

  // 按渠道控制
  push_enabled: boolean;  // Push 推送总开关
  email_enabled: boolean; // 邮件通知总开关

  // 细粒度（可选，高级设置）
  overrides: {
    [notificationType: string]: {
      enabled: boolean;
      channels: string[];
    };
  };

  // 免打扰时段
  dnd_start?: string;     // "23:00"
  dnd_end?: string;       // "08:00"
  dnd_timezone?: string;  // "Asia/Shanghai"
}
```

### 数据库表

```sql
-- 通知记录
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES profiles(id) NOT NULL,
  actor_id UUID,
  type TEXT NOT NULL,                   -- 'social.like', 'finance.income' 等
  category TEXT NOT NULL,               -- 'social', 'finance', 'system' 等
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  action_url TEXT,
  channels TEXT[] NOT NULL,             -- 实际发送的渠道
  priority TEXT DEFAULT 'normal',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  aggregation_key TEXT,                 -- 聚合键（如 'like:{post_id}'）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引：按用户查未读通知（最常用查询）
CREATE INDEX idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, created_at DESC)
  WHERE is_read = false;

-- 用户通知偏好
CREATE TABLE notification_preferences (
  user_id UUID REFERENCES profiles(id) PRIMARY KEY,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push 设备注册（Phase 4）
CREATE TABLE push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  platform TEXT NOT NULL,               -- 'ios' / 'android' / 'web'
  token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);
```

### 通知管道伪代码

```typescript
async function sendNotification(event: NotificationEvent) {
  // 1. 检查接收者偏好
  const prefs = await getPreferences(event.recipientId);
  if (!prefs[event.category]) return;  // 用户关闭了该类通知

  // 2. 检查免打扰时段
  if (isInDndPeriod(prefs, event.priority)) {
    if (event.priority !== 'urgent') return;  // urgent 无视 DND
  }

  // 3. 聚合检查
  const existing = await checkAggregation(event);
  if (existing) {
    await updateAggregated(existing, event);
    return;
  }

  // 4. 写入 DB
  const notification = await saveNotification(event);

  // 5. 分发到各渠道
  const channels = filterChannels(event.channels, prefs);
  for (const channel of channels) {
    switch (channel) {
      case 'in_app':
        await supabaseRealtime.broadcast(event.recipientId, notification);
        break;
      case 'push':
        await pushService.send(event.recipientId, notification);
        break;
      case 'email':
        await emailQueue.enqueue(event.recipientId, notification);
        break;
    }
  }
}
```

### SDK 接口

应用通过 SDK 触发通知：

```typescript
// 应用内给用户发通知（需要 notification 权限）
await billai.notification.send({
  recipientId: userId,
  title: '你赢了！',
  body: '恭喜获得第一名，奖金 $10.00',
  actionUrl: '/game/result/xxx',
});

// 平台限制：
// - 每应用每用户每天最多 10 条通知
// - 通知内容需通过内容审核
// - 应用不能给未安装该应用的用户发通知
```

---

## 17.2 搜索系统

### 为什么必须第一天设计

搜索涉及 DB 索引。如果表已经有百万行数据再加全文索引：
- `CREATE INDEX` 会锁表（大表可能几分钟到几十分钟）
- 不加索引 = 全表扫描 = 慢查询

**从第一天就建好索引，零成本。后补索引，有风险。**

### 搜索范围

| 搜索对象 | 搜索字段 | 场景 |
|---------|---------|------|
| 应用 | name, description, category | 应用商店搜索 |
| 用户 | username, display_name | @提及、好友搜索 |
| 频道 | name, description | 频道发现 |
| 帖子/Feed | content | Feed 内容搜索 |
| 聊天消息 | content | 聊天记录搜索 |

### 技术方案：PostgreSQL 全文搜索

Supabase 原生支持 PostgreSQL 全文搜索，不需要额外服务。

```sql
-- 应用表添加搜索向量列
ALTER TABLE apps ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'C')
  ) STORED;

CREATE INDEX idx_apps_search ON apps USING GIN(search_vector);

-- 搜索查询
SELECT *, ts_rank(search_vector, query) AS rank
FROM apps, plainto_tsquery('simple', '投票') query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;
```

**为什么用 `simple` 而不是 `english`**：
- Bill.ai 是多语言平台（中英为主）
- `simple` 分词器按空格/标点切分，对中英混合最通用
- 中文可以后期接 `zhparser` 扩展或 jieba 分词

### 需要预建索引的表

| 表 | 索引列 | 权重 |
|----|--------|------|
| `apps` | name(A), description(B), category(C) | 最重要 |
| `profiles` | username(A), display_name(B) | 重要 |
| `channels` | name(A), description(B) | 重要 |

帖子和聊天消息的索引可以 Phase 3 再加（数据量起来之后）。

### 搜索 API 统一格式

```typescript
// 统一搜索接口
GET /api/v1/search?q={query}&type={type}&page={page}&limit={limit}

// type: 'apps' | 'users' | 'channels' | 'all'

// 响应
{
  results: {
    apps: [{ id, name, icon, rating, matchScore }],
    users: [{ id, username, avatar, matchScore }],
    channels: [{ id, name, memberCount, matchScore }],
  },
  total: { apps: 15, users: 3, channels: 2 },
  query: "投票",
  took_ms: 12
}
```

### 后期升级路径

当数据量超过百万级，PostgreSQL 全文搜索可能不够快。升级选项：

| 方案 | 特点 | 适合阶段 |
|------|------|---------|
| PostgreSQL FTS | 零成本，Supabase 原生 | Phase 1-3 |
| Meilisearch | 开源，毫秒级，自托管 | Phase 3-4 |
| Algolia | SaaS，最快，但贵 | Phase 4+ |

---

## 17.3 国际化 (i18n)

### 为什么必须第一天设计

**每一个 UI 字符串** 都必须走 i18n。如果硬编码了中文，后面要支持英文 = 改几百个文件。Rich Game 已经经历过这个痛苦。

### i18n 策略

```
三层 i18n:

① 平台 UI      → react-i18next（Bill.ai 前端）
② 系统消息      → 后端模板（通知/邮件/错误信息）
③ 应用商店内容  → 应用 Manifest 多语言字段
```

### 翻译 key 规范

```
格式: {module}.{section}.{label}

示例:
  store.search.placeholder     → "搜索应用..."
  store.app.install            → "安装"
  store.app.uninstall          → "卸载"
  store.review.submit          → "提交评价"
  notification.social.like     → "{actor} 赞了你的 {target}"
  notification.finance.income  → "你收到 {amount} 收入"
  error.auth.invalid_token     → "登录已过期，请重新登录"
  error.wallet.insufficient    → "余额不足"
```

### 支持语言

| 阶段 | 语言 | 说明 |
|------|------|------|
| Phase 1 | 中文(zh) + 英文(en) | 最小可用 |
| Phase 3 | + 日文(ja) + 韩文(ko) | 东亚市场 |
| Phase 4 | + 西班牙语(es) + 更多 | 全球化 |

### 前端 i18n 实现

Bill.ai 已有 `react-i18next`，确保：

```typescript
// ✅ 正确：所有字符串走 i18n
const { t } = useTranslation();
<Button>{t('store.app.install')}</Button>

// ❌ 错误：硬编码中文
<Button>安装</Button>
```

### 翻译文件结构

```
platform/public/locales/
  zh/
    common.json        — 通用（按钮、状态、错误）
    store.json         — 应用商店
    notification.json  — 通知
    settings.json      — 设置
    dashboard.json     — Dashboard
  en/
    common.json
    store.json
    ...
```

### 后端消息 i18n

后端返回的错误信息和通知内容也需要 i18n：

```typescript
// 方案 1：后端返回 i18n key，前端翻译
{ error: 'error.wallet.insufficient' }

// 方案 2：后端根据用户 locale 返回翻译后的文本
{ error: '余额不足' }  // 根据 Accept-Language 或用户设置

// 建议：Phase 1 用方案 1（简单），Phase 3 改方案 2（体验更好）
```

### Manifest 多语言

应用在商店中的名称和描述支持多语言：

```json
{
  "name": {
    "zh": "趣味投票",
    "en": "Fun Poll"
  },
  "description": {
    "zh": "让粉丝投票选择...",
    "en": "Let fans vote to choose..."
  }
}
```

### RTL 支持

暂不支持 RTL（阿拉伯语/希伯来语）。如果未来需要：
- CSS 使用逻辑属性（`margin-inline-start` 而非 `margin-left`）
- 从 Phase 1 开始使用逻辑属性，后期零成本支持 RTL

---

## 17.4 API 版本控制

### 为什么必须第一天定

一旦第三方开发者开始用你的 SDK 和 API：
- 改接口 = 破坏现有应用
- 没有版本号 = 无法废弃旧接口
- 这是**不可逆的设计决策**

### 版本策略

```
三层版本控制:

① 平台 API        → URL 路径: /api/v1/...
② App SDK          → npm 语义化版本: @billai/app-sdk@1.x.x
③ postMessage 协议 → 协议头版本号: { version: 1, ... }
```

### 平台 API 版本

```
URL 格式: /api/v{major}/{resource}

示例:
  /api/v1/apps              — 应用列表
  /api/v1/apps/:id          — 应用详情
  /api/v1/search            — 搜索
  /api/v1/users/:id         — 用户信息

版本升级:
  /api/v1/apps → /api/v2/apps（响应格式变化）
  v1 保持运行至少 6 个月
```

### SDK 版本

```typescript
// package.json
{
  "name": "@billai/app-sdk",
  "version": "1.0.0"  // 语义化版本
}

// 版本规则:
//   1.0.0 → 1.0.1   patch: bug 修复，不破坏兼容
//   1.0.0 → 1.1.0   minor: 新增功能，向后兼容
//   1.0.0 → 2.0.0   major: 破坏性变更，需要开发者改代码
```

### postMessage 协议版本

```typescript
interface SDKMessage {
  version: number;    // 协议版本号，从 1 开始
  id: string;
  type: string;
  payload: any;
}

// 平台侧兼容处理
function handleMessage(msg: SDKMessage) {
  if (msg.version === 1) {
    // v1 协议处理
  } else if (msg.version === 2) {
    // v2 协议处理
  } else {
    // 未知版本，返回错误
  }
}
```

### Manifest 版本

```json
{
  "manifest_version": 1,
  "sdk_version": "^1.0.0",
  "...": "..."
}
```

平台根据 `manifest_version` 决定如何解析 Manifest。
`sdk_version` 声明应用需要的 SDK 最低版本。

### 废弃策略

```
新版本发布后:
  → 旧版本标记为 deprecated
  → 开发者控制台显示升级提醒
  → 旧版本继续运行 6 个月
  → 6 个月后通知开发者，再给 3 个月
  → 共 9 个月后关闭旧版本
```

### 变更日志

每次 API / SDK 变更必须记录：

```markdown
## SDK Changelog

### v1.1.0 (2026-xx-xx)
- 新增: billai.storage.upload() 支持断点续传
- 新增: billai.ui.requestReview() 评分引导

### v1.0.0 (2026-xx-xx)
- 初始版本
```

---

## 17.5 实现阶段

| Phase | 系统 | 功能 |
|-------|------|------|
| **0** | API 版本 | URL 前缀 `/api/v1/`、postMessage 协议 `version: 1` |
| **0** | i18n | 平台 UI 全部走 `react-i18next`、翻译文件结构建立 |
| **1** | 通知 | 应用内通知（Supabase Realtime）、通知列表、已读标记 |
| **1** | 搜索 | PostgreSQL 全文索引（apps + profiles + channels） |
| **1** | i18n | 中文 + 英文两种语言完成 |
| **2** | 通知 | 聚合、用户偏好设置、SDK 通知接口 |
| **2** | 搜索 | 搜索 API 统一格式、搜索结果页 |
| **3** | 通知 | 邮件通知、灵动岛 |
| **3** | i18n | 后端消息 i18n、Manifest 多语言 |
| **4** | 通知 | Push 推送（FCM + APNs） |
| **4** | 搜索 | 升级 Meilisearch（如果需要） |
| **4** | API 版本 | SDK v2 发布、废弃策略启动 |
