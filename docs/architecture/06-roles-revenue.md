# 06 — 角色体系与分润机制

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 6.1 角色 = 能力，不是身份

```
所有人注册进来都是「用户」
  → 创建了应用       → 自动获得「开发者」能力
  → 创建了频道       → 自动获得「频道主」能力
  → 生成了推广链接   → 自动获得「推广者」能力
  → 一个人可以同时拥有所有能力
```

**实现方式**：`profiles` 表不需要 `role` 字段。通过关联表判断：

```typescript
// 是否是开发者？ → 查 apps 表有没有他发布的应用
const isDeveloper = await db.apps.count({ developer_id: userId }) > 0;

// 是否是频道主？ → 查 channels 表有没有他创建的频道
const isChannelOwner = await db.channels.count({ owner_id: userId }) > 0;

// 是否是推广者？ → 查 promoter_links 表有没有他的推广链接
const isPromoter = await db.promoter_links.count({ user_id: userId }) > 0;
```

**UI 展示**：在用户个人资料页显示角色徽章（可以有多个）。

## 6.2 五条分润链路

每笔交易最多涉及 5 方分润：

```
用户在频道 A 中使用 Rich Game 花了 100 USDC

分润链路:
  ┌──────────────────────────────────────────────────┐
  │  100 USDC 进入分账引擎                             │
  │                                                    │
  │  1. 平台抽成    5%  →  5 USDC  → 平台账户          │
  │  2. 开发者分成  70% → 70 USDC  → Rich Game 开发者  │
  │  3. 频道主分成  15% → 15 USDC  → 频道 A 的主人     │
  │  4. 推广者分成   5% →  5 USDC  → 推荐该用户的人    │
  │  5. 应用内分配   5% →  5 USDC  → 游戏奖池/其他     │
  │                                                    │
  │  注意: 不是每笔交易都有 5 方                        │
  │  - 用户自己找来的 → 没有推广者分成，开发者多拿      │
  │  - 不在频道内使用 → 没有频道主分成，开发者多拿      │
  └──────────────────────────────────────────────────┘
```

### 分润比例配置

分润比例由**应用开发者**在 Manifest 中声明，平台审核：

```json
// billai.manifest.json
{
  "revenue": {
    "platformFee": 500,        // 5% — 平台固定抽成（BPS，万分比）
    "developerShare": 7000,    // 70% — 开发者
    "channelShare": 1500,      // 15% — 频道主
    "promoterShare": 500,      // 5% — 推广者
    "appReserve": 500          // 5% — 应用自留（奖池等）
    // 总计: 10000 (100%)
  }
}
```

**规则**：
- `platformFee` 由平台设定，开发者不能修改（最低 5%）
- 其余比例由开发者设定，总和必须 = 10000
- 如果没有频道主/推广者，其份额归开发者

### 分润结算

```
实时分账（每笔交易立即计算）:
  ├── 用户付费 → 从用户余额扣除
  ├── 分账引擎计算各方份额
  ├── 写入 revenue_splits 表
  └── 各方余额实时增加

提现:
  ├── 各角色在自己的 Dashboard 查看收入
  ├── 满足最低提现额度（如 10 USDC）后可提现
  └── 提现走平台统一流程（钱包/银行卡）
```

## 6.3 各角色的 Dashboard

### 开发者 Dashboard

```
我的应用:
  ├── 应用列表（状态、安装量、评分）
  ├── 创建新应用 / 编辑应用
  ├── 提交审核 / 查看审核状态
  └── 应用设置（权限、分润比例、地区限制）

收入统计:
  ├── 总收入、今日收入、趋势图
  ├── 按应用分的收入明细
  ├── 按频道分的收入明细（哪些频道给你带来最多收入）
  └── 提现记录

数据分析:
  ├── DAU / MAU / 留存率
  ├── 付费转化率
  └── 用户反馈和评价
```

### 频道主 Dashboard

```
我的频道:
  ├── 频道列表
  ├── 创建新频道
  ├── 频道设置（名称、头像、描述、规则）
  └── 安装/卸载应用到频道

频道成员:
  ├── 成员列表
  ├── 角色管理（管理员、版主、普通成员）
  └── 封禁/踢人

频道收入:
  ├── 总收入（来自频道内应用交易的分成）
  ├── 按应用分的收入明细
  └── 提现记录
```

### 推广者 Dashboard

```
推广链接:
  ├── 生成推广链接（针对应用 / 频道 / 平台）
  ├── 链接列表 + 复制 + 分享
  └── 自定义推广码

推广数据:
  ├── 点击量、注册量、转化率
  ├── 推广带来的用户列表（脱敏）
  └── 各链接的效果对比

推广收入:
  ├── 总收入（CPA 注册奖励 + CPS 交易分成）
  ├── 按用户分的收入明细
  └── 提现记录
```

## 6.4 分润引擎伪代码

```typescript
async function splitRevenue(transaction: AppTransaction): Promise<void> {
  const app = await getApp(transaction.app_id);
  const revenueConfig = app.manifest.revenue;
  const amount = transaction.amount;

  // 1. 平台抽成（固定）
  const platformFee = Math.floor(amount * revenueConfig.platformFee / 10000);
  await createSplit(transaction.id, 'platform', null, platformFee);

  // 2. 查找频道主（用户是从哪个频道进入的？）
  const channelCtx = await getChannelContext(transaction.user_id, transaction.app_id);
  let channelShare = 0;
  if (channelCtx) {
    channelShare = Math.floor(amount * revenueConfig.channelShare / 10000);
    await createSplit(transaction.id, 'channel', channelCtx.ownerId, channelShare);
  }

  // 3. 查找推广者（谁推荐这个用户来的？）
  const referral = await getReferral(transaction.user_id);
  let promoterShare = 0;
  if (referral) {
    promoterShare = Math.floor(amount * revenueConfig.promoterShare / 10000);
    await createSplit(transaction.id, 'promoter', referral.referrerId, promoterShare);
  }

  // 4. 应用自留
  const appReserve = Math.floor(amount * revenueConfig.appReserve / 10000);
  await createSplit(transaction.id, 'app_reserve', app.developer_id, appReserve);

  // 5. 开发者拿剩余的（包含无人认领的频道主/推广者份额）
  const developerShare = amount - platformFee - channelShare - promoterShare - appReserve;
  await createSplit(transaction.id, 'developer', app.developer_id, developerShare);
}
```

## 6.5 数据库表

```sql
-- 频道
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  is_public BOOLEAN DEFAULT true,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 频道成员
CREATE TABLE channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  role TEXT DEFAULT 'member',           -- 'owner' | 'admin' | 'moderator' | 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- 频道安装的应用
CREATE TABLE channel_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) NOT NULL,
  app_id TEXT NOT NULL,
  installed_by UUID REFERENCES profiles(id) NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}',
  UNIQUE(channel_id, app_id)
);

-- 分润记录（每笔交易的分账明细）
CREATE TABLE revenue_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,         -- 关联 app_transactions.id
  app_id TEXT NOT NULL,
  role TEXT NOT NULL,                   -- 'platform' | 'developer' | 'channel' | 'promoter' | 'app_reserve'
  recipient_id UUID REFERENCES profiles(id),  -- 收款人（platform 时为 NULL）
  amount BIGINT NOT NULL,               -- micro-USDC
  bps INTEGER NOT NULL,                 -- 实际分润比例
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 角色收入汇总（定期聚合，加速查询）
CREATE TABLE role_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  role TEXT NOT NULL,                   -- 'developer' | 'channel_owner' | 'promoter'
  period TEXT NOT NULL,                 -- '2026-03' 月度
  total_amount BIGINT DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role, period)
);
```
