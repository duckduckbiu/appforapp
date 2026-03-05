# 18 — 安全架构 · 数据分析 · 监控 · 邮件 · 法律

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。
> 这些系统属于"运营基础设施"——不直接是用户功能，但没有它们平台无法安全、可靠地运行。

---

## 18.1 安全架构

### 为什么必须第一天设计

安全不是"加个功能"，而是渗透到每一层的基础设施。后补安全 = 到处打补丁 + 永远补不完。

### 安全分层

```
┌─────────────────────────────────────────────┐
│               安全架构五层模型                 │
├─────────────────────────────────────────────┤
│                                             │
│  ⑤ 网络层      Cloudflare DDoS + WAF       │
│       ↓                                     │
│  ④ 传输层      HTTPS/HSTS 强制 + TLS 1.3   │
│       ↓                                     │
│  ③ 接口层      API 限流 + 输入验证 + CORS    │
│       ↓                                     │
│  ② 应用层      认证 + 授权 + CSP + 沙盒     │
│       ↓                                     │
│  ① 数据层      加密存储 + RLS + 密钥管理     │
│                                             │
└─────────────────────────────────────────────┘
```

### ⑤ 网络层：DDoS 防护

```
Cloudflare 免费方案即可:
  - 自动 DDoS 缓解
  - Bot 管理（挡爬虫/恶意流量）
  - 域名配置: *.billai.app → Cloudflare → 源服务器

Phase 1: 接入 Cloudflare（免费）
Phase 3: 升级 Pro（$20/月，高级 WAF 规则）
```

### ④ 传输层：HTTPS

```
强制规则:
  - 所有域名 HTTPS only（HSTS header）
  - TLS 1.2 最低，推荐 1.3
  - HTTP → HTTPS 301 自动重定向
  - API 调用不允许 HTTP

Header 设置:
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### ③ 接口层：API 安全

#### 限流策略

```typescript
// 三层限流

// 1. 全局限流（防 DDoS）
//    每 IP 每分钟 100 次
rateLimit({ windowMs: 60_000, max: 100, keyGenerator: (req) => req.ip });

// 2. 接口限流（防滥用）
//    登录: 每 IP 每分钟 5 次
//    注册: 每 IP 每小时 3 次
//    搜索: 每用户每分钟 30 次
//    评论: 每用户每分钟 10 次

// 3. 应用限流（防恶意应用）
//    每应用每分钟 1000 次 SDK 调用
//    每应用每用户每天 10 条通知
```

#### 输入验证

```typescript
// 所有 API 输入必须用 Zod/Joi 验证
// 禁止直接信任客户端数据

// ✅ 正确
const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5),
});
const data = schema.parse(req.body);

// ❌ 错误
const { name, description, rating } = req.body;  // 直接使用
```

#### CORS 策略

```typescript
// 平台 API
cors({
  origin: [
    'https://app.billai.app',
    'https://admin.billai.app',
    'https://dev.billai.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

// 应用 API（各应用后端自己配置）
// 不允许 origin: '*'
```

### ② 应用层：CSP + 沙盒

#### Content Security Policy

```
平台页面 CSP:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://*.supabase.co https://*.r2.dev data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  frame-src https://apps.billai.app;
  frame-ancestors 'none';

应用 iframe 沙盒属性:
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"

  不允许: allow-top-navigation（防止应用劫持平台页面）
```

#### 认证安全

```
Token 安全规则:
  - JWT 有效期: 用户 7 天, Admin 8 小时, App Token 1 小时
  - Refresh Token: 30 天（Phase 2）
  - Token 存储: httpOnly cookie（不存 localStorage）
  - 敏感操作需要 re-auth（修改密码、绑定钱包、提现）
```

### ① 数据层：加密 + RLS

```
静态加密:
  - 数据库: Supabase 自动加密（AES-256）
  - 文件存储: R2 自动加密
  - 敏感字段（钱包私钥、HD 助记词）: 应用层 AES 加密后再存 DB

RLS (Row Level Security):
  - Supabase 所有表必须启用 RLS
  - 默认拒绝，显式授权
  - 每张表的 RLS 策略在 12-tech-decisions.md 中定义

密钥管理:
  - 生产密钥只存环境变量，不入代码库
  - 密钥轮换: JWT_SECRET 每 90 天轮换（Phase 3）
  - 不同环境（dev/staging/prod）使用不同密钥
```

### 安全事件响应

```
安全事件分级:

P0 紧急（5分钟内响应）:
  - 数据泄露
  - 资金被盗
  - 全站不可用

P1 严重（1小时内响应）:
  - 用户账号被盗
  - 恶意应用上架
  - API 密钥泄露

P2 中等（24小时内响应）:
  - 批量恶意注册
  - 刷分/刷评论
  - 单用户投诉

响应流程:
  发现 → 确认 → 隔离（封禁/下架） → 修复 → 复盘 → 加固
```

---

## 18.2 埋点 & 数据分析

### 为什么重要

没有数据 = 盲目做产品。但如果事件格式不统一，后面拼凑出来的数据不可用。

### 事件命名规范

```
格式: {object}.{action}

object: 名词（app, user, channel, review, subscription, promotion）
action: 动词（view, click, install, uninstall, create, submit, purchase）

示例:
  app.view              用户浏览应用详情页
  app.install           用户安装应用
  app.uninstall         用户卸载应用
  app.launch            用户打开应用
  review.submit         用户提交评价
  review.helpful        用户点击"有用"
  subscription.start    用户开始订阅
  subscription.cancel   用户取消订阅
  promotion.click       推广链接被点击
  promotion.convert     推广链接带来注册
  search.query          用户搜索
  search.result_click   用户点击搜索结果
```

### 事件结构

```typescript
interface AnalyticsEvent {
  // 标识
  event: string;              // 事件名 'app.install'
  timestamp: string;          // ISO 时间戳

  // 上下文
  userId?: string;            // 用户 ID（匿名用户为空）
  sessionId: string;          // 会话 ID
  deviceId: string;           // 设备指纹

  // 属性
  properties: {
    [key: string]: string | number | boolean;
  };

  // 来源
  source: {
    platform: 'web' | 'ios' | 'android';
    appVersion: string;
    locale: string;
    referrer?: string;
  };
}
```

### 核心指标定义

| 指标 | 定义 | 计算方式 |
|------|------|---------|
| **DAU** | 日活跃用户 | 当天有任意 event 的 unique userId |
| **MAU** | 月活跃用户 | 30 天内有任意 event 的 unique userId |
| **留存率** | N 日后仍活跃的比例 | Day N DAU ÷ Day 0 新用户数 |
| **安装转化率** | 浏览→安装的比例 | app.install ÷ app.view |
| **ARPU** | 每用户平均收入 | 总收入 ÷ MAU |
| **ARPPU** | 每付费用户平均收入 | 总收入 ÷ 付费用户数 |
| **LTV** | 用户生命周期价值 | ARPU × 平均活跃月数 |

### 选型方向

| 方案 | 特点 | 建议阶段 |
|------|------|---------|
| **自建（Supabase 表）** | 零成本，灵活，但需要自己做报表 | Phase 1 |
| **PostHog（自托管）** | 开源，功能全，免费版够用 | Phase 2-3 |
| **Mixpanel** | SaaS，强大，但免费额度有限 | Phase 4+ |

### 数据库表（Phase 1 自建版）

```sql
-- 分析事件表（按月分区，防止单表过大）
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  user_id UUID,
  session_id TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  source JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 按时间分区（PostgreSQL 原生分区）
-- 实际建表时按月创建分区
CREATE INDEX idx_analytics_event_type ON analytics_events(event, created_at);
CREATE INDEX idx_analytics_user ON analytics_events(user_id, created_at);

-- 每日聚合表（定时任务生成，查询用）
CREATE TABLE analytics_daily (
  date DATE NOT NULL,
  metric TEXT NOT NULL,         -- 'dau', 'new_users', 'app_installs' 等
  dimension TEXT,               -- 可选维度（如 app_id, country）
  value BIGINT NOT NULL,
  PRIMARY KEY(date, metric, dimension)
);
```

### 前端埋点 SDK

```typescript
// 平台前端统一埋点函数
function track(event: string, properties?: Record<string, any>) {
  const payload: AnalyticsEvent = {
    event,
    timestamp: new Date().toISOString(),
    userId: getCurrentUserId(),
    sessionId: getSessionId(),
    deviceId: getDeviceId(),
    properties: properties || {},
    source: {
      platform: getPlatform(),
      appVersion: APP_VERSION,
      locale: i18n.language,
    },
  };

  // 批量上报（每 10 秒或满 20 条）
  eventBuffer.push(payload);
  if (eventBuffer.length >= 20) flushEvents();
}

// 使用
track('app.install', { appId: 'rich-game', source: 'search' });
track('search.query', { query: '投票', resultCount: 15 });
```

---

## 18.3 错误监控 & 可观测性

### 三大支柱

```
可观测性 = Logs（日志）+ Metrics（指标）+ Traces（追踪）
```

### 日志标准

```typescript
// 统一日志格式（JSON）
{
  "level": "error",
  "message": "Failed to process payment",
  "timestamp": "2026-03-04T12:00:00Z",
  "service": "platform-api",        // 哪个服务
  "traceId": "abc-123-def",         // 请求追踪 ID
  "userId": "user-uuid",
  "appId": "rich-game",
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "User balance is 0",
    "stack": "..."
  },
  "context": {
    "amount": 5000000,
    "endpoint": "/api/v1/wallet/charge"
  }
}
```

### 请求追踪 ID (Trace ID)

**每个请求从前端到后端全程携带同一个 trace_id**：

```
前端发起请求
  → Header: X-Trace-Id: abc-123
    → 平台 API 日志: traceId: abc-123
      → Supabase 查询: traceId: abc-123
      → SDK 调用应用: traceId: abc-123
        → 应用后端日志: traceId: abc-123
```

排查问题时，用 trace_id 串联所有日志 = **秒级定位**。

### 错误追踪选型

| 方案 | 特点 | 建议阶段 |
|------|------|---------|
| **Sentry（免费版）** | 5K errors/月，source map，release tracking | Phase 1 |
| **Sentry（Team）** | 50K errors/月，$26/月 | Phase 3+ |
| **自建（日志表）** | 零成本但功能弱 | 备选 |

### 告警规则

```
自动告警:
  - API 错误率 > 5%（5分钟窗口） → Slack/邮件告警
  - P99 延迟 > 3 秒 → 告警
  - 数据库连接池用尽 → 紧急告警
  - 某应用 SDK 调用量突增 10x → 可疑告警
  - 用户注册量异常（1小时内 > 100%日均） → 可疑告警
```

### 健康检查

```
每个服务暴露 /health 端点:

GET /health
{
  "status": "healthy",
  "version": "1.2.3",
  "uptime": 86400,
  "checks": {
    "database": "ok",
    "supabase": "ok",
    "r2": "ok"
  }
}

外部监控（UptimeRobot / BetterStack 免费版）:
  每 1 分钟检查 /health
  连续 3 次失败 → 告警
```

---

## 18.4 邮件系统

### 邮件场景

| 类型 | 场景 | 优先级 | 阶段 |
|------|------|--------|------|
| **认证邮件** | 注册确认、密码重置、邮箱变更 | 最高（即时） | Phase 1 |
| **安全邮件** | 新设备登录、异常操作告警 | 最高（即时） | Phase 1 |
| **业务邮件** | 应用审核结果、收入通知、提现确认 | 高（分钟级） | Phase 2 |
| **通知邮件** | 有人评论/关注、频道活动 | 中（可聚合） | Phase 3 |
| **营销邮件** | 新功能公告、活动推广 | 低（批量） | Phase 4 |

### 选型

| 方案 | 价格 | 特点 | 建议 |
|------|------|------|------|
| **Resend** | 3K 封/月免费 | 开发者友好，API 简洁 | ✅ Phase 1 |
| SendGrid | 100 封/天免费 | 老牌，功能全 | 备选 |
| AWS SES | $0.10/1K封 | 最便宜，但配置复杂 | Phase 4 大量时 |

### 邮件模板系统

```typescript
// 邮件模板注册
const EMAIL_TEMPLATES = {
  'auth.verify': {
    subject: { zh: '验证你的邮箱', en: 'Verify your email' },
    template: 'verify-email',     // 对应模板文件
    variables: ['username', 'verifyUrl', 'expireMinutes'],
  },
  'auth.reset_password': {
    subject: { zh: '重置密码', en: 'Reset your password' },
    template: 'reset-password',
    variables: ['username', 'resetUrl', 'expireMinutes'],
  },
  'app.approved': {
    subject: { zh: '你的应用已通过审核', en: 'Your app has been approved' },
    template: 'app-approved',
    variables: ['appName', 'appUrl'],
  },
  'finance.income': {
    subject: { zh: '你有新的收入', en: 'You have new income' },
    template: 'income-notification',
    variables: ['amount', 'source', 'dashboardUrl'],
  },
};
```

### 退订机制

```
CAN-SPAM / GDPR 合规:
  - 每封非认证邮件底部必须有退订链接
  - 一键退订（List-Unsubscribe header）
  - 退订后 7 天内不再发送
  - 认证邮件和安全邮件不可退订
```

---

## 18.5 法律文档框架

### 必须准备的文档

| 文档 | 用途 | 阶段 |
|------|------|------|
| **Terms of Service (ToS)** | 用户使用平台的条款 | Phase 1（上线前） |
| **Privacy Policy** | 数据收集和使用说明 | Phase 1（上线前） |
| **Developer Agreement** | 开发者上传应用的条款 | Phase 1 |
| **Acceptable Use Policy** | 禁止行为（NSFW、赌博、欺诈等） | Phase 1 |
| **DMCA Policy** | 版权侵权投诉和处理流程 | Phase 2 |
| **Cookie Policy** | Cookie 使用说明（GDPR 需要） | Phase 2 |
| **Data Processing Agreement** | 数据处理协议（B2B/GDPR） | Phase 3 |

### ToS 关键条款

```
用户条款必须覆盖:
  1. 账号责任（一人一号、禁止共享）
  2. 内容所有权（用户上传的内容归谁）
  3. 平台免责（应用质量由开发者负责）
  4. 虚拟货币和退款政策
  5. 封禁和申诉权利
  6. 争议解决（仲裁/管辖地）
  7. 未成年人保护（年龄门槛）
  8. 修改条款的通知义务
```

### Developer Agreement 关键条款

```
开发者协议必须覆盖:
  1. 应用审核标准和拒绝原因
  2. 分润比例和支付条款
  3. 知识产权归属（应用代码归开发者）
  4. 数据使用限制（不能窃取用户数据）
  5. 应用下架条件
  6. 责任划分（平台 vs 开发者）
  7. 保密条款（API 密钥、内部接口）
  8. 终止和数据迁出
```

### DMCA 版权流程

```
投诉 → 平台收到 DMCA 通知
     → 48h 内下架侵权内容
     → 通知被投诉方（开发者/用户）
     → 被投诉方可提交反通知（Counter-notice）
     → 10-14 个工作日如无诉讼 → 恢复内容
```

### 用户同意记录

```sql
-- 用户同意记录（GDPR 要求可审计）
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  consent_type TEXT NOT NULL,         -- 'tos', 'privacy', 'marketing', 'cookies'
  version TEXT NOT NULL,              -- 条款版本号 'tos-v1.2'
  accepted BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 当 ToS 更新时，要求用户重新同意
-- profiles 表已有 accepted_tos_at 和 accepted_privacy_at 列
```

### 数据主体权利（GDPR）

```
用户有权:
  1. 访问权（Right of Access）— 导出自己的所有数据
  2. 删除权（Right to Erasure）— 注销账号并删除数据
  3. 纠正权（Right to Rectification）— 修改错误的个人信息
  4. 可携权（Right to Portability）— 导出为通用格式

平台实现:
  - 用户设置 → "下载我的数据"按钮 → 导出 JSON/ZIP
  - 用户设置 → "删除账号"按钮 → 30 天冷静期 → 永久删除
  - 删除范围: profiles, notifications, reviews, subscriptions
  - 保留范围: 财务记录（法律要求保留 5-7 年）
```

---

## 18.6 Feature Flag 系统（🟢 后期可加）

简要记录方向，Phase 3 再实现：

```
用途: 灰度发布新功能（先给 10% 用户 → 50% → 100%）

方案:
  Phase 1-2: 简单的 platform_config 表开关
  Phase 3:   专用 feature_flags 表 + 用户分组规则
  Phase 4:   接入 PostHog Feature Flags 或 LaunchDarkly

表结构（预留）:
  feature_flags (flag_key, enabled, rollout_percentage, user_segment, ...)
```

---

## 18.7 实现阶段汇总

| Phase | 系统 | 具体功能 |
|-------|------|---------|
| **0** | 安全 | HTTPS 强制、CSP header、CORS 配置 |
| **0** | 日志 | 统一 JSON 日志格式、trace_id 生成 |
| **1** | 安全 | API 限流（三层）、输入验证标准（Zod） |
| **1** | 安全 | Supabase RLS 全表启用 |
| **1** | 监控 | /health 端点、UptimeRobot 外部监控 |
| **1** | 监控 | Sentry 接入（前端 + 后端） |
| **1** | 邮件 | Resend 接入、认证邮件（验证/重置） |
| **1** | 法律 | ToS + Privacy Policy + Developer Agreement |
| **1** | 埋点 | 事件命名规范、analytics_events 表、前端 track() 函数 |
| **2** | 安全 | iframe 沙盒安全审计、应用 CSP 策略 |
| **2** | 邮件 | 业务邮件模板（审核/收入通知） |
| **2** | 法律 | Acceptable Use Policy + DMCA 流程 |
| **2** | 埋点 | analytics_daily 聚合表、核心指标仪表盘 |
| **3** | 安全 | 密钥轮换机制、安全事件响应流程 |
| **3** | 监控 | 告警规则（错误率/延迟/异常流量） |
| **3** | 邮件 | 通知邮件 + 退订机制 |
| **3** | 法律 | Cookie Policy + GDPR 数据导出/删除 |
| **3** | 埋点 | PostHog 接入（如果自建不够用） |
| **4** | 安全 | Cloudflare WAF 规则、渗透测试 |
| **4** | 安全 | 数据加密审计、合规认证 |
| **4** | 法律 | Data Processing Agreement |
