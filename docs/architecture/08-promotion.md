# 08 — 推广系统

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 8.1 推广系统概述

```
推广系统的本质:
  追踪「谁带来了谁」+「谁推荐了什么」
  然后在每笔交易时自动分润给推广者

三种推广模式:
  ├── CPA（Cost Per Action）— 按注册付费
  │   推广者每带来一个新注册用户，获得固定奖励
  │
  ├── CPS（Cost Per Sale）— 按交易分成
  │   推广者推荐的用户在应用内每笔消费，推广者获得分成
  │   这是长期收入，有复利效应
  │
  └── 频道推广 — 按频道成员付费
      推广者带人加入付费频道，获得订阅分成
```

## 8.2 推广链接机制

### 链接生成

```
推广者在 Dashboard 生成链接:

  推广平台: https://billai.app/r/abc123
  推广应用: https://billai.app/r/abc123?app=rich-game
  推广频道: https://billai.app/r/abc123?channel=gaming-hub

链接参数:
  r/{code}     → 推广者的唯一推广码
  ?app=xxx     → 指定推广的应用
  ?channel=xxx → 指定推广的频道
```

### 归因规则

```
用户点击推广链接:
  1. 记录 cookie/localStorage: { referrerCode: 'abc123', timestamp: ... }
  2. 归因窗口: 30 天（点击后 30 天内注册都算该推广者的）
  3. 用户注册时:
     a. 读取归因信息
     b. 写入 referral_attributions 表
     c. 绑定关系永久有效（除非推广者违规被取消）
  4. 如果用户在注册前点击了多个推广链接:
     → Last Click 归因（最后一次点击的推广者获得归因）
```

### 防作弊

```
防刷注册:
  ├── 同 IP 每日注册限制
  ├── 新用户必须完成邮箱验证才算有效注册
  ├── 自推自（推广者 = 被推广者）自动过滤
  └── 异常注册模式检测（如大量注册无活跃）

防刷交易:
  ├── 推广者和被推广者之间的直接转账不算分润
  ├── 新用户首次消费有最小金额要求（如 1 USDC）
  └── 异常交易模式检测
```

## 8.3 CPA 奖励（注册奖励）

```
推广者 A 分享链接 → 用户 B 点击注册

触发条件:
  ├── 用户 B 完成注册（邮箱验证通过）
  ├── 用户 B 在归因窗口内（30 天）
  └── 用户 B 此前没有被其他推广者归因

奖励:
  ├── 推广者 A 获得 CPA 奖励（平台设定，如 0.5 USDC/注册）
  ├── 用户 B 也可以获得新用户奖励（可选，如 0.5 USDC 体验金）
  └── 奖励从平台营销预算出（不走应用分润）
```

### 配置

```sql
-- platform_config 表
INSERT INTO platform_config (key, value) VALUES
  ('cpa_reward_referrer', '500000'),    -- 推广者得 0.5 USDC（micro）
  ('cpa_reward_referee', '500000'),     -- 新用户得 0.5 USDC
  ('cpa_enabled', 'true'),
  ('referral_window_days', '30');
```

## 8.4 CPS 分润（交易分成）

```
推广者 A 的链接带来了用户 B
用户 B 在 Rich Game 中消费了 100 USDC

分润引擎自动计算:
  ├── 查找 referral_attributions: B 是被 A 推荐的
  ├── 查找 Manifest: promoterShare = 500 (5%)
  ├── 推广者 A 获得: 100 * 5% = 5 USDC
  └── 写入 revenue_splits 表

CPS 是长期收入:
  只要 B 在平台上消费，A 就永远有分成
  这激励推广者带来高质量（高消费）用户
```

## 8.5 推广者 Dashboard

```
┌─ 推广中心 ────────────────────────────────────────┐
│                                                    │
│  总览:                                              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │ 总收入 │  │ 今日 │  │ 推广 │  │ 转化率│          │
│  │$1,234 │  │ $56  │  │ 327人│  │ 12%  │          │
│  └──────┘  └──────┘  └──────┘  └──────┘          │
│                                                    │
│  我的推广链接:                                       │
│  ┌────────────────────────────────────────────┐    │
│  │ 📱 平台推广    billai.app/r/abc123          │    │
│  │    点击: 2,451  注册: 327  收入: $890       │    │
│  │    [复制] [分享] [数据]                      │    │
│  ├────────────────────────────────────────────┤    │
│  │ 🎮 Rich Game   billai.app/r/abc123?app=rg  │    │
│  │    点击: 892    安装: 156  收入: $344       │    │
│  │    [复制] [分享] [数据]                      │    │
│  └────────────────────────────────────────────┘    │
│                                                    │
│  收入趋势: [日] [周] [月]                           │
│  ┌────────────────────────────────────────────┐    │
│  │  $60 ┤     ╭─╮                              │    │
│  │  $40 ┤  ╭──╯ ╰─╮  ╭──╮                     │    │
│  │  $20 ┤──╯       ╰──╯  ╰─                   │    │
│  │   $0 ┤─────────────────────────             │    │
│  │       Mon Tue Wed Thu Fri Sat Sun           │    │
│  └────────────────────────────────────────────┘    │
│                                                    │
│  推广素材:                                          │
│  ├── 📦 Rich Game 推广包（图片+文案）下载            │
│  ├── 📦 平台通用推广包                              │
│  └── 🔧 自定义落地页生成器                          │
│                                                    │
└────────────────────────────────────────────────────┘
```

## 8.6 推广素材系统

```
开发者可以在应用设置中上传推广素材:
  ├── 宣传图片（多尺寸：方形、横幅、竖版）
  ├── 宣传文案（多语言）
  ├── 短视频素材（可选）
  └── 落地页模板

推广者在 Dashboard 获取素材:
  ├── 一键下载推广包
  ├── 素材自动嵌入推广者的推广码
  └── 自动生成带推广码的海报图
```

## 8.7 数据库表

```sql
-- 推广链接
CREATE TABLE promoter_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,     -- 推广者
  target_type TEXT NOT NULL,            -- 'platform' | 'app' | 'channel'
  target_id TEXT,                       -- app_id 或 channel_id
  code TEXT UNIQUE NOT NULL,            -- 推广码
  click_count INTEGER DEFAULT 0,
  register_count INTEGER DEFAULT 0,
  revenue_total BIGINT DEFAULT 0,       -- 累计收入 micro-USDC
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 推广归因
CREATE TABLE referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,      -- 被推荐的用户
  referrer_id UUID REFERENCES profiles(id) NOT NULL,   -- 推荐人
  link_id UUID REFERENCES promoter_links(id),
  attributed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)                       -- 每个用户只有一个推荐人
);

-- 推广链接点击记录（用于分析）
CREATE TABLE promoter_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES promoter_links(id) NOT NULL,
  ip_hash TEXT,                         -- IP 哈希（脱敏，防重复计数）
  user_agent TEXT,
  referrer_url TEXT,                    -- 来源页面
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CPA 奖励记录
CREATE TABLE cpa_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id) NOT NULL,
  referee_id UUID REFERENCES profiles(id) NOT NULL,
  referrer_amount BIGINT NOT NULL,      -- 推广者奖励
  referee_amount BIGINT DEFAULT 0,      -- 新用户奖励
  link_id UUID REFERENCES promoter_links(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 8.8 Phase 规划

| 功能 | Phase 0 | Phase 1 | Phase 2 | Phase 3+ |
|------|---------|---------|---------|----------|
| 推广链接数据模型 | ✅ 建表 | — | — | — |
| 推广链接生成 | — | ✅ 基础版 | ✅ | ✅ |
| 归因追踪 | — | ✅ Last Click | ✅ | ✅ |
| CPA 注册奖励 | — | ✅ | ✅ | ✅ |
| CPS 交易分成 | — | ✅（和分润引擎联动） | ✅ | ✅ |
| 推广者 Dashboard | — | — | ✅ 基础版 | ✅ 完整版 |
| 推广素材系统 | — | — | — | ✅ |
| 防作弊系统 | — | ✅ 基础 | ✅ 高级 | ✅ |
