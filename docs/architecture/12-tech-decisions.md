# 12 — 关键技术决策 + 数据库总表

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 12.1 决策 1：为什么用 iframe 而不是 Module Federation？

| 方案 | 隔离性 | 复杂度 | 安全性 | 兼容性 |
|------|--------|--------|--------|--------|
| **iframe** ✅ | 完全隔离 | 低 | 高（浏览器原生沙盒） | 所有浏览器 |
| Module Federation | 共享内存 | 高 | 低（共享 JS 上下文） | 需要 Webpack |
| Web Components | 部分隔离 | 中 | 中 | 较新浏览器 |

**选择 iframe**：浏览器原生安全沙盒，苹果 4.7 合规，应用崩溃不影响平台，维护成本低。

## 12.2 决策 2：为什么平台用 Supabase 而不是自建 Express？

| 维度 | Supabase | 自建 Express |
|------|----------|-------------|
| 开发速度 | 快（开箱即用） | 慢（什么都要自己写） |
| 认证 | 内置（邮箱/OAuth/手机） | 自己实现 |
| 实时推送 | 内置 Realtime | 自己搭 WebSocket |
| 文件存储 | 内置 Storage | 自己搭 S3/OSS |
| 运维 | 托管（Supabase Cloud） | 自己部署维护 |
| 灵活性 | 中等 | 完全自由 |

**选择 Supabase**：平台核心是标准 CRUD（社交/聊天/Feed），Supabase 开箱即用。Rich Game 保留 Express 处理游戏逻辑。

## 12.3 决策 3：钱包和资金的平台 vs 应用边界

> 详见 [04-wallet.md](./04-wallet.md)

```
核心原则：应用永远不碰钱

平台层: user_balances + balance_transactions + 双币充值
应用层: 只能通过 SDK 发指令 charge() / reward()
分润: 分润引擎在平台层自动计算五方分账
```

## 12.4 决策 4：为什么登录不再用钱包连接？

> 详见 [03-backend.md](./03-backend.md)

| 维度 | 钱包登录（旧） | 邮箱/OAuth 登录（新） |
|------|-------------|-------------------|
| 用户门槛 | 高（需要 MetaMask） | 低（人人有邮箱） |
| 苹果审核 | 不合规 | 合规（Apple Sign-In） |
| 用户覆盖 | 仅 Web3 用户 | 全部用户 |
| 账号恢复 | 困难（丢私钥 = 丢账号） | 简单（忘记密码 → 邮箱重置） |

**决策**：登录 = Supabase Auth（邮箱/Google/Apple），钱包 = 用户设置中的绑定功能。

## 12.5 决策 5：为什么大文件存储选 Cloudflare R2？

> 详见 [09-storage.md](./09-storage.md)

| 服务 | 存储 (/TB/月) | 流出流量 (/TB) | CDN |
|------|-------------|--------------|-----|
| **Cloudflare R2** ✅ | $15 | **$0** | 自带 |
| Backblaze B2 | $6 | $10 | 需配 CF |
| AWS S3 | $23 | $90 | 需配 CloudFront |

**决策**：视频平台最大成本是流出流量，R2 流出免费，且自带全球 CDN。

## 12.6 决策 6：角色体系——硬角色 vs 能力解锁

> 详见 [06-roles-revenue.md](./06-roles-revenue.md)

| 方案 | 用户体验 | 实现复杂度 | 灵活性 |
|------|---------|-----------|--------|
| 硬角色（注册时选） | 差（被锁死） | 低 | 低 |
| **能力解锁** ✅ | 好（自然获得） | 中 | 高 |

**决策**：角色通过行为自动解锁，不需要注册时选择。一个人可以同时是开发者+频道主+推广者。

---

## 12.7 全部数据库表汇总

### 平台核心表（Supabase，已有）

```
profiles                    用户资料（Supabase Auth 自动创建）
  + date_of_birth DATE      【新增列】生日（年龄分级用）
  + country_code TEXT        【新增列】国家代码（地区限制用）
  + accepted_tos_at          【新增列】接受条款时间
  + accepted_privacy_at      【新增列】接受隐私政策时间
  + trust_score INTEGER      【新增列】信誉分 0-100
```

### 应用商店表（Supabase，新建）

```sql
-- 已注册的应用
CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  developer_id UUID REFERENCES profiles(id),
  icon_url TEXT,
  entry_url TEXT NOT NULL,
  backend_url TEXT,
  manifest JSONB NOT NULL,
  category TEXT DEFAULT 'general',
  age_rating TEXT DEFAULT '4+',
  status TEXT DEFAULT 'draft',       -- draft/submitted/in_review/published/suspended/rejected
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户安装的应用
CREATE TABLE user_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  app_id TEXT REFERENCES apps(app_id) NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  UNIQUE(user_id, app_id)
);

-- 应用权限授予
CREATE TABLE app_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  app_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted BOOLEAN DEFAULT false,
  granted_at TIMESTAMPTZ,
  UNIQUE(user_id, app_id, permission)
);

-- 应用评价
CREATE TABLE app_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  app_id TEXT REFERENCES apps(app_id) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, app_id)
);
```

### 钱包与交易表（Supabase，从 Rich Game 迁入）

```sql
-- 用户余额（已有，从 Rich Game 迁入）
-- user_balances (user_id, balance BIGINT, ...)

-- 余额流水（已有，从 Rich Game 迁入）
-- balance_transactions (user_id, amount, type, ...)

-- 充值地址（已有，从 Rich Game 迁入）
-- user_deposit_addresses (user_id, chain, address, ...)

-- 用户绑定的提现钱包（新建）
CREATE TABLE user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  chain_type TEXT NOT NULL,
  address TEXT NOT NULL,
  label TEXT,
  is_default BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, address)
);

-- 应用内交易
CREATE TABLE app_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  app_id TEXT NOT NULL,
  type TEXT NOT NULL,                -- 'charge' | 'reward' | 'refund'
  amount BIGINT NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  platform_fee BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 频道表（Supabase，新建）

```sql
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

CREATE TABLE channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

CREATE TABLE channel_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) NOT NULL,
  app_id TEXT NOT NULL,
  installed_by UUID REFERENCES profiles(id) NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}',
  UNIQUE(channel_id, app_id)
);
```

### 分润表（Supabase，新建）

```sql
CREATE TABLE revenue_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  app_id TEXT NOT NULL,
  role TEXT NOT NULL,
  recipient_id UUID REFERENCES profiles(id),
  amount BIGINT NOT NULL,
  bps INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  role TEXT NOT NULL,
  period TEXT NOT NULL,
  total_amount BIGINT DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role, period)
);
```

### 订阅表（Supabase，新建）

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  owner_ref TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly BIGINT,
  price_yearly BIGINT,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  plan_id TEXT REFERENCES subscription_plans(plan_id) NOT NULL,
  period TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id)
);

CREATE TABLE subscription_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) NOT NULL,
  amount BIGINT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  transaction_id UUID,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 推广表（Supabase，新建）

```sql
CREATE TABLE promoter_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  code TEXT UNIQUE NOT NULL,
  click_count INTEGER DEFAULT 0,
  register_count INTEGER DEFAULT 0,
  revenue_total BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  referrer_id UUID REFERENCES profiles(id) NOT NULL,
  link_id UUID REFERENCES promoter_links(id),
  attributed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE promoter_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES promoter_links(id) NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referrer_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cpa_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id) NOT NULL,
  referee_id UUID REFERENCES profiles(id) NOT NULL,
  referrer_amount BIGINT NOT NULL,
  referee_amount BIGINT DEFAULT 0,
  link_id UUID REFERENCES promoter_links(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 合规表（Supabase，新建）

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id) NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'pending',
  resolution TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  scope TEXT NOT NULL,
  reason TEXT NOT NULL,
  report_id UUID REFERENCES reports(id),
  banned_by UUID REFERENCES profiles(id) NOT NULL,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_preview TEXT,
  auto_flag_reason TEXT,
  auto_flag_confidence FLOAT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  report_id UUID REFERENCES reports(id),
  ban_id UUID REFERENCES bans(id),
  issued_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 存储表（Supabase，新建）

```sql
CREATE TABLE storage_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES profiles(id) NOT NULL,
  app_id TEXT,
  storage_backend TEXT NOT NULL,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  url TEXT,
  is_public BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'ready',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_storage_usage (
  app_id TEXT PRIMARY KEY,
  total_size BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  quota BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_storage_usage (
  user_id UUID REFERENCES profiles(id) PRIMARY KEY,
  total_size BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  quota BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Rich Game 保留的表（独立 PostgreSQL）

不变：`games`, `rounds`, `players`, `votes`, `chat_messages`, `world_chat`, `action_logs`

迁出：`user_balances` → 平台层，`balance_transactions` → 平台层
