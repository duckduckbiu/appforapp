# 15 — 后台管理架构

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 15.1 后台体系总览

Bill.ai 有 **5 种角色**，每种角色需要不同的管理界面。
核心原则：**按职责分离，按规模定形态**。

```
┌──────────────────────────────────────────────────┐
│                    后台体系                        │
├──────────────────────────────────────────────────┤
│                                                  │
│  独立 Web 应用（单独部署，独立域名）                  │
│  ┌──────────────────────────────────────────┐    │
│  │ ① 平台管理后台    admin.billai.app        │    │
│  │   → 平台运营团队使用                       │    │
│  ├──────────────────────────────────────────┤    │
│  │ ② 开发者控制台    dev.billai.app          │    │
│  │   → 应用开发者使用                         │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  主站内嵌页面（app.billai.app 内的路由）             │
│  ┌──────────────────────────────────────────┐    │
│  │ ③ 频道主 Dashboard  /dashboard/channel    │    │
│  │ ④ 推广者 Dashboard  /dashboard/promoter   │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  应用自管理（各应用独立，不属于平台）                  │
│  ┌──────────────────────────────────────────┐    │
│  │ ⑤ 应用自有后台    各应用自行部署             │    │
│  │   例: Rich Game Admin 保持独立              │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 为什么这样分？

| 方案 | 适用场景 | 原因 |
|------|---------|------|
| **独立 Web 应用** | 平台管理后台 + 开发者控制台 | 功能重、安全要求高、使用频率高、独立部署方便维护 |
| **主站内嵌** | 频道主 + 推广者 Dashboard | 功能轻、用户就在主站中、不值得单独部署 |
| **应用自管理** | 各应用后台 | 平台不管应用内部运营，应用自己的事自己管 |

---

## 15.2 平台管理后台（admin.billai.app）

### 定位

给 Bill.ai **运营团队**用的内部工具。管理平台级事务：用户、应用审核、合规、财务。

### 认证

- 独立登录（不是普通用户账号）
- 管理员账号由超级管理员创建
- 支持 2FA（TOTP）
- 按角色分权：超级管理员 / 审核员 / 运营 / 财务 / 只读

```
管理员角色:
  super_admin   → 全部权限
  reviewer      → 内容审核 + 应用审核
  operator      → 用户管理 + 频道管理
  finance       → 财务报表 + 提现审批
  readonly      → 只读查看
```

### 功能模块

```
┌─ 平台管理后台 ─────────────────────────────┐
│                                            │
│  📊 仪表盘                                  │
│  ├── 今日概览（DAU/MAU/新增/收入/交易量）      │
│  ├── 实时在线用户数                          │
│  ├── 收入趋势图（7日/30日/全部）              │
│  └── 待处理事项（审核/举报/提现）              │
│                                            │
│  👥 用户管理                                 │
│  ├── 用户列表（搜索/过滤/排序）               │
│  ├── 用户详情（资料/余额/交易/登录记录）       │
│  ├── 封禁/解封管理                           │
│  ├── 处罚记录                               │
│  └── 信誉分管理                              │
│                                            │
│  📱 应用管理                                 │
│  ├── 应用列表（所有/待审核/已上架/已下架）      │
│  ├── 应用审核队列                            │
│  │   ├── Manifest 自动检查结果               │
│  │   ├── 安全扫描结果                        │
│  │   └── 人工审核（通过/拒绝/要求修改）        │
│  ├── 应用详情（数据/评分/收入/举报）           │
│  └── 应用下架/恢复                           │
│                                            │
│  📺 频道管理                                 │
│  ├── 频道列表                               │
│  ├── 频道详情                               │
│  └── 违规频道处理                            │
│                                            │
│  🛡️ 合规中心                                │
│  ├── 举报队列（按优先级排序）                  │
│  │   ├── 用户举报                            │
│  │   ├── 应用举报                            │
│  │   ├── 评论举报                            │
│  │   └── 频道举报                            │
│  ├── 审核历史                               │
│  ├── 内容审核队列（AI 标记的可疑内容）         │
│  └── 封禁列表 + 申诉处理                     │
│                                            │
│  💰 财务中心                                 │
│  ├── 平台收入总览（6 条收入线）               │
│  ├── 分润明细（五方分账记录）                  │
│  ├── 提现审批队列                            │
│  ├── 订阅收入统计                            │
│  └── 存储费用统计                            │
│                                            │
│  ⚙️ 平台设置                                │
│  ├── 全局参数（平台费率/分润比例/门槛值）       │
│  ├── 订阅套餐管理                            │
│  ├── 管理员账号管理                           │
│  └── 系统日志                               │
│                                            │
└────────────────────────────────────────────┘
```

### 技术方案

| 维度 | 选型 |
|------|------|
| 框架 | React + Vite（与现有 Admin 一致） |
| UI | 同平台 Design Token + shadcn/ui |
| 数据 | 直接查 Supabase（Admin API 或 Supabase Admin SDK） |
| 部署 | 独立域名 `admin.billai.app`，Vercel / Railway |
| 认证 | 独立 JWT（与普通用户账号体系分离） |

---

## 15.3 开发者控制台（dev.billai.app）

### 定位

给**应用开发者**用的工具。管理自己的应用、查看数据、配置分润、查看收入。

### 认证

- 使用 **Bill.ai 普通账号**登录（Supabase Auth）
- 额外检查：用户是否已解锁开发者角色（`apps` 表中有记录）
- 如果没有解锁，显示"创建你的第一个应用"引导页

### 功能模块

```
┌─ 开发者控制台 ─────────────────────────────┐
│                                            │
│  📊 概览                                    │
│  ├── 我的应用列表（评分/安装量/收入一览）      │
│  ├── 总收入趋势                              │
│  └── 待办事项（待回复评论/审核反馈）           │
│                                            │
│  📱 应用管理                                 │
│  ├── 创建新应用（填写 Manifest）              │
│  ├── 应用设置                               │
│  │   ├── 基本信息（名称/描述/图标/截图）       │
│  │   ├── 技术配置（entry_url/backend_url）   │
│  │   ├── 分润配置（频道主/推广者比例）         │
│  │   ├── 权限声明                            │
│  │   ├── 年龄分级                            │
│  │   ├── 地区限制                            │
│  │   └── 订阅套餐（如果应用有付费订阅）        │
│  ├── 版本管理（提交新版本/查看审核状态）        │
│  └── 提交审核 / 上架 / 下架                   │
│                                            │
│  📈 数据分析                                 │
│  ├── 安装/卸载趋势                           │
│  ├── 活跃用户（DAU/MAU/留存）                │
│  ├── 使用时长分布                            │
│  ├── 频道安装分布                            │
│  └── 地区分布                               │
│                                            │
│  ⭐ 评分与评论（详见 14-rating-system.md）    │
│  ├── 评分概览（平均分/分布/趋势）              │
│  ├── 评论列表（可筛选：待回复/全部/差评）       │
│  ├── 回复评论                               │
│  └── 举报不当评论                            │
│                                            │
│  💰 收入                                    │
│  ├── 收入总览（按日/周/月）                   │
│  ├── 分润明细（每笔交易的五方分账）            │
│  ├── 订阅收入（如果有）                       │
│  ├── 各频道带来的收入排行                     │
│  └── 提现记录                               │
│                                            │
│  🔑 开发者设置                               │
│  ├── API 密钥管理                            │
│  ├── Webhook 配置                           │
│  ├── 存储用量 + 配额                         │
│  ├── 开发者订阅（Free/Pro/Enterprise）        │
│  └── 团队成员管理（Enterprise 功能）           │
│                                            │
│  📖 文档与工具                               │
│  ├── SDK 文档                               │
│  ├── API 参考                               │
│  ├── 应用模板下载                            │
│  └── 测试工具（沙盒环境）                     │
│                                            │
└────────────────────────────────────────────┘
```

### 技术方案

| 维度 | 选型 |
|------|------|
| 框架 | React + Vite |
| UI | 同平台 Design Token + shadcn/ui |
| 数据 | Supabase（RLS 隔离，开发者只能看自己的数据） |
| 部署 | 独立域名 `dev.billai.app`，同平台部署 |
| 认证 | Supabase Auth（复用平台账号体系） |

### Supabase RLS 安全

开发者控制台直连 Supabase，必须用 RLS 确保数据隔离：

```sql
-- 开发者只能看到自己的应用
CREATE POLICY "developers_own_apps" ON apps
  FOR SELECT USING (developer_id = auth.uid());

-- 开发者只能看到自己应用的评论
CREATE POLICY "developers_see_own_app_reviews" ON app_reviews
  FOR SELECT USING (
    app_id IN (SELECT app_id FROM apps WHERE developer_id = auth.uid())
  );

-- 开发者只能看到自己应用的分润
CREATE POLICY "developers_see_own_revenue" ON revenue_splits
  FOR SELECT USING (
    app_id IN (SELECT app_id FROM apps WHERE developer_id = auth.uid())
  );
```

---

## 15.4 频道主 Dashboard（主站内嵌）

### 定位

频道主在主站内管理自己的频道。不需要独立网站——功能相对轻量。

### 入口

主站路由 `/dashboard/channel`，在用户个人中心可以看到入口（当用户拥有至少一个频道时显示）。

### 功能模块

```
┌─ 频道主 Dashboard ─────────────────────────┐
│                                            │
│  📺 我的频道                                 │
│  ├── 频道列表                               │
│  ├── 创建新频道                              │
│  └── 频道切换                               │
│                                            │
│  📱 频道应用管理                              │
│  ├── 已安装应用列表                          │
│  ├── 从商店安装应用（跳转应用商店，带频道标记）  │
│  ├── 卸载应用                               │
│  └── 应用排序（在频道内的展示顺序）            │
│                                            │
│  👥 成员管理                                 │
│  ├── 成员列表                               │
│  ├── 角色设置（管理员/成员）                   │
│  ├── 邀请/移除成员                           │
│  └── 封禁成员                               │
│                                            │
│  💰 收入                                    │
│  ├── 频道总收入（来自频道内应用交易的 15% 分润）│
│  ├── 各应用贡献的收入排行                     │
│  ├── 频道订阅收入（如果开启）                  │
│  └── 收入趋势图                              │
│                                            │
│  📈 数据                                    │
│  ├── 成员增长趋势                            │
│  ├── 频道活跃度                              │
│  └── 各应用在频道内的使用数据                  │
│                                            │
│  ⚙️ 频道设置                                │
│  ├── 名称/描述/头像                          │
│  ├── 公开/私密                              │
│  ├── 订阅设置（是否开启 + 价格）              │
│  └── 通知偏好                               │
│                                            │
└────────────────────────────────────────────┘
```

### 技术方案

- **不是独立项目**，是主站（`platform/src/pages/dashboard/`）的一部分
- 共享主站组件和 Context
- 数据通过 Supabase RLS 隔离（频道主只看到自己的频道）

---

## 15.5 推广者 Dashboard（主站内嵌）

### 定位

推广者在主站内查看推广效果和收入。同样是轻量功能，不需要独立站点。

### 入口

主站路由 `/dashboard/promoter`，在用户个人中心可以看到入口（当用户拥有至少一个推广链接时显示）。

### 功能模块

```
┌─ 推广者 Dashboard ─────────────────────────┐
│                                            │
│  📊 概览                                    │
│  ├── 总推广收入                              │
│  ├── 总点击 / 注册 / 转化率                   │
│  └── 本月收入 vs 上月                        │
│                                            │
│  🔗 推广链接管理                              │
│  ├── 我的推广链接列表                         │
│  │   ├── 应用推广链接                        │
│  │   ├── 频道推广链接                        │
│  │   └── 平台推广链接                        │
│  ├── 生成新链接                              │
│  ├── 每条链接的数据                           │
│  │   ├── 点击量                             │
│  │   ├── 注册转化数                          │
│  │   ├── CPA 奖励                           │
│  │   └── CPS 分润收入                        │
│  └── 推广素材下载（横幅/海报/二维码）           │
│                                            │
│  💰 收入明细                                 │
│  ├── CPA 奖励记录（每笔注册）                 │
│  ├── CPS 分润记录（每笔交易的 5%）            │
│  ├── 按日/周/月汇总                          │
│  └── 提现记录                               │
│                                            │
│  📈 数据分析                                 │
│  ├── 点击来源分析                            │
│  ├── 转化漏斗（点击→注册→活跃→付费）           │
│  ├── 各应用推广效果对比                       │
│  └── 归因用户的后续行为（LTV）                │
│                                            │
└────────────────────────────────────────────┘
```

---

## 15.6 应用自有后台

### 定位

平台**不管**应用内部的运营后台。每个应用可以有自己的 Admin 面板。

### Rich Game 的例子

Rich Game 已有完整的 Admin 面板（`/admin-panel/`），迁入 Bill.ai 后**保持独立**：

```
Rich Game Admin（现有）:
  ├── 游戏管理（创建/配置/结束游戏）
  ├── 轮次管理
  ├── 玩家管理
  ├── 财务管理（平台费/佣金）
  ├── 系统设置
  └── 操作日志

迁入后变化:
  - 认证: 改用 App Token（由 Bill.ai 签发）
  - 余额: 改调 SDK wallet 接口（不直接操作 user_balances）
  - 其余不变
```

### 平台与应用后台的边界

```
平台管应用级事务:           应用自己管内部事务:
  ├── 应用上架/下架           ├── 游戏房间管理
  ├── 应用审核                ├── 游戏内道具/货币
  ├── 用户举报                ├── 游戏规则配置
  ├── 评分/评论               ├── 游戏内聊天管理
  ├── 分润/收入               ├── 游戏数据分析
  └── 存储配额                └── 应用内运营活动
```

---

## 15.7 数据库表（后台系统相关）

### 管理员表（新建）

```sql
-- 平台管理员（与普通用户分离）
CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'readonly',   -- super_admin/reviewer/operator/finance/readonly
  totp_secret TEXT,                        -- 2FA 密钥
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_by UUID REFERENCES platform_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 管理员操作日志（审计追踪）
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES platform_admins(id) NOT NULL,
  action TEXT NOT NULL,              -- 'approve_app' / 'ban_user' / 'approve_withdrawal'
  target_type TEXT,                  -- 'user' / 'app' / 'channel' / 'review'
  target_id TEXT,
  detail JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 开发者团队表（Enterprise 功能）

```sql
CREATE TABLE developer_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE developer_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES developer_teams(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  role TEXT DEFAULT 'member',        -- owner / admin / member / viewer
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(team_id, user_id)
);
```

---

## 15.8 实现阶段

| Phase | 后台 | 功能 |
|-------|------|------|
| **1** | 平台管理后台 | 骨架版——用户列表/封禁、应用审核队列、举报队列 |
| **1** | 开发者控制台 | 骨架版——创建应用/提交 Manifest、查看审核状态 |
| **2** | Rich Game Admin | 改造——认证切换为 App Token，余额切换为 SDK 调用 |
| **2** | 频道主 Dashboard | 基础版——频道管理、应用安装、成员管理 |
| **3** | 推广者 Dashboard | 基础版——链接管理、数据查看、收入明细 |
| **3** | 平台管理后台 | 完善——财务中心、合规中心、审核 Dashboard |
| **3** | 开发者控制台 | 完善——数据分析、评分管理、收入明细 |
| **4** | 开发者控制台 | 高级——团队管理、API 密钥、文档站 |
| **4** | 平台管理后台 | 高级——平台参数热配、管理员权限、2FA |

---

## 15.9 各后台的技术栈对比

| 维度 | 平台管理后台 | 开发者控制台 | 频道主/推广者 Dashboard |
|------|------------|------------|---------------------|
| 部署 | 独立（admin.billai.app） | 独立（dev.billai.app） | 主站内嵌 |
| 框架 | React + Vite | React + Vite | 主站 React 组件 |
| UI | shadcn/ui + Design Token | shadcn/ui + Design Token | 主站统一组件 |
| 认证 | 独立 JWT（平台管理员账号） | Supabase Auth（开发者账号） | Supabase Auth（频道主/推广者账号） |
| 数据层 | Admin API / Supabase Admin SDK | Supabase + RLS | Supabase + RLS |
| 安全级别 | 最高（2FA + 审计日志 + IP 白名单） | 高（账号 + 开发者验证） | 中（普通用户 + RLS） |
| 代码位置 | `platform/admin/` | `platform/dev-console/` | `platform/src/pages/dashboard/` |

---

## 15.10 与其他系统的关联

| 系统 | 关联 |
|------|------|
| 角色体系（06） | Dashboard 入口根据用户解锁的角色动态显示 |
| 评分系统（14） | 开发者控制台的评分管理模块 |
| 合规审核（05） | 平台管理后台的合规中心 |
| 分润（06） | 所有 Dashboard 都有收入板块 |
| 订阅（07） | 开发者控制台管理应用订阅套餐 |
| 推广（08） | 推广者 Dashboard 展示推广数据 |
| 应用审核（05） | 平台管理后台 + 开发者控制台两端联动 |
