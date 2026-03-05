# 07 — 订阅系统

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 7.1 四种订阅类型

```
┌──────────────────────────────────────────────────────────────┐
│                     Bill.ai 统一订阅引擎                       │
│                                                              │
│  1. 平台订阅（用户 → 平台）                                    │
│     类似 Discord Nitro                                       │
│     用户支付月费获得平台高级功能                                 │
│                                                              │
│  2. 应用订阅（用户 → 应用）                                    │
│     类似 Netflix / Spotify                                   │
│     用户支付月费获得应用高级功能，收入按分润比例分配              │
│                                                              │
│  3. 频道订阅（用户 → 频道）                                    │
│     类似 Twitch 订阅主播 / Patreon                            │
│     用户支付月费获得频道专属内容/权限                            │
│                                                              │
│  4. 开发者服务订阅（开发者 → 平台）                             │
│     类似 Apple Developer Program                             │
│     开发者支付费用获得更高 API 配额、优先审核等                  │
└──────────────────────────────────────────────────────────────┘
```

## 7.2 平台订阅（用户 → 平台）

### 套餐设计

| 功能 | 免费用户 | Bill.ai Pro（$9.99/月）| Bill.ai Max（$19.99/月）|
|------|---------|----------------------|------------------------|
| 应用安装数 | 10 个 | 50 个 | 无限 |
| 存储空间 | 1 GB | 10 GB | 100 GB |
| 文件上传大小 | 25 MB | 100 MB | 500 MB |
| 自定义头像框 | ❌ | ✅ | ✅ |
| 专属徽章 | ❌ | ⭐ Pro | 💎 Max |
| 高清视频上传 | ❌ | 720p | 4K |
| 优先客服 | ❌ | ❌ | ✅ |
| 广告 | 有 | 无 | 无 |

### 收入归属

```
平台订阅收入 → 100% 归平台（不走分润引擎）
```

## 7.3 应用订阅（用户 → 应用）

### 开发者定义订阅套餐

```json
// billai.manifest.json
{
  "subscriptions": [
    {
      "planId": "rich-game-vip",
      "name": "Rich Game VIP",
      "description": "专属皮肤、优先匹配、VIP 标识",
      "prices": {
        "monthly": 5000000,      // 5 USDC/月
        "yearly": 50000000       // 50 USDC/年（打 83 折）
      },
      "features": [
        "exclusive-skins",
        "priority-matching",
        "vip-badge"
      ]
    },
    {
      "planId": "rich-game-premium",
      "name": "Rich Game Premium",
      "prices": {
        "monthly": 10000000,
        "yearly": 100000000
      },
      "features": [
        "all-vip-features",
        "create-private-rooms",
        "advanced-stats"
      ]
    }
  ]
}
```

### 应用内使用

```typescript
// 检查用户是否有订阅
const sub = await billai.subscription.check('rich-game-vip');
if (sub.active) {
  // 显示 VIP 功能
  showVIPFeatures();
} else {
  // 显示付费墙
  showPaywall();
}

// 发起订阅
try {
  const result = await billai.subscription.subscribe({
    planId: 'rich-game-vip',
    period: 'monthly',
  });
  // 平台弹出订阅确认页面
  // 用户确认后自动扣款
  // 返回 subscriptionId
} catch (e) {
  if (e.code === 'USER_CANCELLED') { ... }
}
```

### 收入分配

```
应用订阅每月扣费时:
  ├── 平台抽成 → 按 Manifest 中的 platformFee（5%）
  ├── 频道主分成 → 按 channelShare（如果从频道进入）
  ├── 推广者分成 → 按 promoterShare（如果有推广关系）
  └── 开发者 → 拿剩余部分

和一次性消费的分润机制完全一致，只是自动按月重复。
```

## 7.4 频道订阅（用户 → 频道）

### 频道主设置订阅

```
频道设置 → 订阅管理:
  ├── 开启/关闭订阅功能
  ├── 设置月费（最低 1 USDC，最高 100 USDC）
  ├── 设置订阅者专属权限:
  │   ├── 查看专属内容（帖子标记为「订阅者可见」）
  │   ├── 专属聊天频道
  │   ├── 专属徽章/角色
  │   └── 提前体验新功能/内容
  └── 预览订阅页面
```

### 收入分配

```
频道订阅收入:
  ├── 平台抽成 10% → 平台
  ├── 推广者分成 5% → 如果有推广关系
  └── 频道主 → 拿剩余 85-90%
```

## 7.5 开发者服务订阅（开发者 → 平台）

| 功能 | 免费开发者 | Dev Pro（$29/月）| Dev Enterprise（$99/月）|
|------|----------|-----------------|------------------------|
| 应用数量 | 3 个 | 10 个 | 无限 |
| API 调用/天 | 1,000 | 50,000 | 500,000 |
| 存储配额 | 1 GB | 50 GB | 500 GB |
| 审核速度 | 标准（3-5 天） | 优先（1-2 天） | 快速（24h） |
| 数据分析 | 基础 | 高级 | 完整 |
| 技术支持 | 社区 | 邮件 | 专属 |
| 自定义域名 | ❌ | ✅ | ✅ |
| Webhook | ❌ | ✅ | ✅ |

## 7.6 统一订阅引擎设计

### 核心数据模型

```sql
-- 订阅套餐定义
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT UNIQUE NOT NULL,         -- 如 'billai-pro', 'rich-game-vip'
  type TEXT NOT NULL,                   -- 'platform' | 'app' | 'channel' | 'developer'
  owner_id UUID REFERENCES profiles(id),  -- 归属（app → developer_id, channel → owner_id）
  owner_ref TEXT,                       -- app_id 或 channel_id
  name TEXT NOT NULL,
  description TEXT,
  price_monthly BIGINT,                 -- micro-USDC/月
  price_yearly BIGINT,                  -- micro-USDC/年
  features JSONB DEFAULT '[]',          -- 功能标识列表
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户的订阅记录
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  plan_id TEXT REFERENCES subscription_plans(plan_id) NOT NULL,
  period TEXT NOT NULL,                 -- 'monthly' | 'yearly'
  status TEXT DEFAULT 'active',         -- 'active' | 'cancelled' | 'expired' | 'past_due'
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id)             -- 一个用户对一个套餐只有一条记录
);

-- 订阅扣费记录
CREATE TABLE subscription_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) NOT NULL,
  amount BIGINT NOT NULL,               -- micro-USDC
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  transaction_id UUID,                  -- 关联 app_transactions.id（走分润引擎）
  status TEXT DEFAULT 'success',        -- 'success' | 'failed' | 'refunded'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 自动续费流程

```
每日凌晨跑定时任务:
  1. 查询所有 status='active' 且 current_period_end < NOW() 的订阅
  2. 对每条订阅:
     a. 尝试从用户余额扣款
     b. 扣款成功 → 更新 current_period_start/end，记录 charge
     c. 扣款失败（余额不足）→ status 改为 'past_due'，通知用户
     d. past_due 超过 7 天 → status 改为 'expired'
  3. 扣款通过分润引擎处理（应用/频道订阅会触发分润）
```

### 用户管理订阅

```
设置 → 我的订阅:
  ├── 当前生效的所有订阅（平台 + 应用 + 频道）
  ├── 每个订阅显示:
  │   ├── 套餐名称 + 价格
  │   ├── 下次扣费日期
  │   ├── 取消订阅按钮
  │   └── 升级/降级按钮
  ├── 历史订阅记录
  └── 扣费记录
```

## 7.7 Phase 规划

| 功能 | Phase 0 | Phase 1 | Phase 2 | Phase 3+ |
|------|---------|---------|---------|----------|
| 订阅数据模型 | ✅ 建表 | — | — | — |
| SDK subscription 模块 | — | ✅ check + subscribe | ✅ 完善 | ✅ |
| 应用订阅 | — | ✅ 基础版 | ✅ 完善 | ✅ |
| 频道订阅 | — | — | ✅ 基础版 | ✅ |
| 平台订阅（Pro/Max） | — | — | — | ✅ |
| 开发者订阅 | — | — | — | ✅ |
| 自动续费引擎 | — | ✅ | ✅ | ✅ |
| Apple IAP 订阅 | — | — | — | ✅ Phase 4 |
