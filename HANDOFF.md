# Bill.ai 平台 — 变更日志

> 每次完成功能后在此追加记录。格式见 CLAUDE.md。

---

## 最近完成的工作

### 1. 项目初始化

**文件**：整个项目结构（新建）

- 从 Rich Game 项目复制 22 篇架构文档（v2.4）
- 从 Bill.ai 社交平台复制可复用的前端代码（shadcn/ui 组件、hooks、Supabase 集成）
- 创建新项目 CLAUDE.md 开发规范
- 创建 Claude Code slash commands（/context、/finish、/dev-check、/status、/services）
- 项目结构：`platform/`（前端）+ `packages/`（SDK + UI 库）+ `docs/`（架构文档）

**来源**：
- 架构文档 ← `/Users/dzfk/Desktop/rich game/docs/architecture/`
- 前端代码 ← `/Users/dzfk/Desktop/bill.ai-main/src/`
- Supabase ← `/Users/dzfk/Desktop/bill.ai-main/supabase/`

### 2. 清理废弃模块 + 简化身份系统

**删除的文件**（16 个）：
- `src/pages/Avatars.tsx`、`AvatarEdit.tsx`、`AvatarManagement.tsx`、`AIPermissionManagement.tsx`、`RemoteControl.tsx`（删除）
- `src/components/AvatarCreationWizard.tsx`（删除）
- `src/components/remote-control/` 整个目录（4 个文件，删除）
- `src/hooks/useRemoteControl.ts`（删除）
- `src/services/actionExecutor.ts`、`screenshotService.ts`（删除）
- `src/types/remote-control.ts`（删除）
- `src/contexts/VoicePlayerContext.tsx`（删除）
- `src/components/layout/IdentitySwitcher.tsx`（删除，替换为 UserMenu）

**新建的文件**：
- `src/components/layout/UserMenu.tsx`（新建）— 简洁用户菜单，替代 IdentitySwitcher

**修改的文件**：
- `src/App.tsx`（修改）— 移除 6 个废弃 imports + 6 条路由
- `src/components/layout/TopHeader.tsx`（修改）— 引用 UserMenu 替代 IdentitySwitcher
- `src/contexts/IdentityContext.tsx`（修改）— 简化，移除多身份切换，保持接口兼容
- `src/hooks/useIdentities.ts`（修改）— 移除 AI 分身查询，只查人类用户 profile
- `src/pages/Index.tsx`（修改）— 更新文案为"应用工厂"，替换 AI 分身卡片为应用商店
- `src/pages/MessagingCenter.tsx`（修改）— 移除 VoicePlayerProvider 包裹
- `src/components/messaging/VoiceMessagePlayer.tsx`（修改）— 移除 useVoicePlayer 依赖，独立工作
- `CLAUDE.md`（修改）— 新增"开始新功能前，优先复用"开发原则

### 3. 防御性编程：无后端时优雅降级

**修改的文件**：
- `src/integrations/supabase/client.ts`（修改）— 防御性初始化，缺失 .env 时使用占位值，导出 `isSupabaseConfigured` 标志
- `src/App.tsx`（修改）— 顶层添加 ErrorBoundary
- `src/contexts/IdentityContext.tsx`（修改）— 无 Supabase 时跳过 auth 检查，直接渲染 Shell

### 4. Phase 0：iframe + SDK 架构验证

**技术选型**：Penpal v6（TypeScript-first, 零依赖, 2KB gzip, postMessage RPC）

**新建的文件**（SDK 包 — `packages/sdk/`）：
- `packages/sdk/package.json`（新建）— @billai/app-sdk 包配置
- `packages/sdk/tsconfig.json`（新建）— SDK TypeScript 配置
- `packages/sdk/src/types.ts`（新建）— SDK 核心类型（SDKRequest, SDKResponse, SDKEvent, UserInfo, ThemeTokens, PlatformMethods, AppMethods）
- `packages/sdk/src/transport.ts`（新建）— Penpal 传输层（initSDK, callPlatform, onEvent, offEvent）
- `packages/sdk/src/modules/user.ts`（新建）— 用户模块（getInfo）
- `packages/sdk/src/modules/ui.ts`（新建）— UI 模块（showToast, getTheme）
- `packages/sdk/src/modules/events.ts`（新建）— 事件模块（on, off）
- `packages/sdk/src/index.ts`（新建）— SDK 入口，导出 billai 对象

**新建的文件**（平台侧）：
- `platform/src/lib/SDKHost.ts`（新建）— 平台侧 SDK 宿主，Penpal connect + WindowMessenger，路由 SDK 请求到 handler（Phase 0 返回 mock 数据）
- `platform/src/components/layout/AppIframe.tsx`（新建）— iframe 沙盒组件，创建 SDKHost 连接
- `platform/src/pages/AppView.tsx`（新建）— 应用页面，根据 appId 加载 iframe

**新建的文件**（测试应用）：
- `platform/public/test-app/index.html`（新建）— SDK 测试应用，3 个按钮测试 user.getInfo / ui.showToast / ui.getTheme
- `platform/public/test-app/penpal.mjs`（新建）— Penpal ESM 本地副本（避免 CDN 依赖）

**修改的文件**：
- `platform/src/App.tsx`（修改）— 添加 `/app/:appId` 路由 + AppView import
- `platform/src/pages/Index.tsx`（修改）— 添加"SDK 测试应用"入口卡片

**验证结果**：
- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ iframe 加载成功，Penpal 握手成功
- ✅ user.getInfo() → 返回 mock 用户数据
- ✅ ui.showToast() → 平台顶层 Sonner toast 通知
- ✅ ui.getTheme() → 返回 10 个 CSS 变量 Design Token

### 5. Supabase 后端连接

**文件**：`platform/.env`（新建）、`platform/supabase/migrations/20251208105249_*.sql`（修改）

- 创建 `.env` 配置 Supabase 凭据（URL + Publishable Key + Project ID）
- 修复迁移文件中硬编码旧数据库 UUID 的数据修复脚本（删除无效 INSERT）
- 推送 30+ 数据库迁移文件到远程 Supabase
- 验证 Supabase 连接正常（Auth API 200、数据库查询 200、CORS 通过）

### 7. Lovable 品牌清除

**文件**：`platform/index.html`、`platform/vite.config.ts`、`platform/src/pages/Admin.tsx`、`platform/supabase/functions/ai-visual-control/index.ts`、`platform/supabase/functions/extract-memory/index.ts`、`platform/public/favicon.svg`（新建）

- 全局搜索并清除所有 Lovable.dev 品牌残留（代码、配置、favicon）
- 删除 `lovable-tagger` Vite 插件及 npm 依赖
- `index.html` 替换 Lovable meta tags 为 Bill.ai 品牌
- 新建 `favicon.svg`（紫色背景 + 白色 "B"），删除旧 `favicon.ico`
- Admin.tsx：2 处"Lovable 密钥管理系统" → "平台密钥管理系统"
- Edge Functions：LOVABLE_API_KEY → AI_API_KEY，Lovable API URL → OpenAI API URL
- ✅ tsc + build 通过

### 8. Phase 1 核心迭代：应用商店 + SDK wallet + App Token

**新建的文件**：
- `platform/supabase/migrations/20260304000000_phase1_apps.sql`（新建）— apps + user_installed_apps 表，RLS，安装计数 trigger，测试种子数据
- `platform/src/hooks/useApps.ts`（新建）— useApps / useApp / useInstalledApps / useInstallApp / useUninstallApp
- `platform/src/pages/AppStore.tsx`（新建）— 应用商店页面，安装/卸载/打开，骨架屏，空态
- `packages/sdk/src/modules/wallet.ts`（新建）— SDK wallet 模块（getBalance, charge）
- `platform/supabase/functions/issue-app-token/index.ts`（新建）— 签发短期 App JWT Token（1h TTL）

**修改的文件**：
- `platform/src/pages/AppView.tsx`（修改）— 从 DB 动态加载应用（移除 Phase 0 硬编码注册表），加载/错误态处理
- `platform/src/lib/SDKHost.ts`（修改）— 新增 wallet.getBalance / wallet.charge / user.getInfo（真实 Supabase 查询）/ user.getAppToken handler
- `packages/sdk/src/modules/user.ts`（修改）— 新增 getAppToken()
- `packages/sdk/src/index.ts`（修改）— 导出 wallet 模块
- `platform/src/App.tsx`（修改）— 注册 /store 路由
- `platform/src/components/layout/AppSidebar.tsx`（修改）— "应用市场" → "应用商店"，URL 改为 /store

**验证**：
- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ supabase db push 通过（apps + user_installed_apps 表已创建）

### 9. Phase 1 继续：合规骨架 + 频道系统

**新建文件**：
- `platform/supabase/migrations/20260304000001_phase1_bans.sql`（新建）— bans 表，RLS（仅管理员读写 + 被封禁用户自读）
- `platform/supabase/migrations/20260304000002_phase1_channels.sql`（新建）— channels + channel_members + channel_apps 表，RLS，成员数自动更新 trigger
- `platform/src/components/AgeGate.tsx`（新建）— 年龄确认遮罩组件（localStorage 缓存确认状态）
- `platform/src/hooks/useChannels.ts`（新建）— useChannels / useChannel / useMyChannels / useChannelMembership / useCreateChannel / useJoinChannel / useLeaveChannel / useAddChannelApp / useRemoveChannelApp
- `platform/src/pages/MyChannels.tsx`（新建）— 我的频道列表页（/my-channels），含创建频道 Sheet
- `platform/src/pages/ChannelDetail.tsx`（新建）— 频道详情页（/channel/:slug），应用 Tab + 成员 Tab

**修改文件**：
- `platform/src/hooks/useReports.ts`（修改）— ReportTargetType 新增 "app" 类型
- `platform/src/pages/AppStore.tsx`（修改）— AppCard 右上角新增三点菜单，含"举报此应用"（复用 ReportDialog）
- `platform/src/contexts/IdentityContext.tsx`（修改）— 登录后查询 bans 表，导出 banInfo 到 Context
- `platform/src/components/layout/MainLayout.tsx`（修改）— banInfo 不为 null 时渲染封禁提示页，屏蔽正常布局
- `platform/src/pages/Admin.tsx`（修改）— 新增 BanManagement 子组件（搜索用户、选择封禁时长/原因、写入 bans 表）
- `platform/src/pages/AppView.tsx`（修改）— 加载应用前检查 age_rating，不为 "all" 时先显示 AgeGate
- `platform/src/App.tsx`（修改）— 新增 /my-channels 和 /channel/:slug 路由

**新建 DB 表**：bans, channels, channel_members, channel_apps

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ supabase db push 通过

---

### 10. Phase 2：推广者系统 + 分润引擎 + 地区限制

**新建文件**：
- `platform/supabase/migrations/20260304000003_phase2_promoter.sql`（新建）— promoter_links / referral_attributions / promoter_clicks 表，RLS，click_count 自动更新 trigger
- `platform/supabase/migrations/20260304000004_phase2_revenue.sql`（新建）— app_transactions / revenue_splits / role_earnings 表，RLS，`process_revenue_split()` SECURITY DEFINER trigger（5-way 分润：平台 5%、开发者 70%、频道主 15%、推广者 5%、App Reserve 5%）
- `platform/supabase/migrations/20260304000005_phase2_geo.sql`（新建）— apps 表新增 allowed_regions TEXT[] 列；user_geo_cache 缓存表
- `platform/src/hooks/usePromoterLinks.ts`（新建）— useMyPromoterLinks / useCreatePromoterLink / useDeletePromoterLink / buildPromoterUrl
- `platform/src/hooks/useUserCountry.ts`（新建）— 24h localStorage 缓存 + ipapi.co 解析 + 写入 user_geo_cache
- `platform/src/pages/PromoterCenter.tsx`（新建）— /promoter 页，统计卡片 + 链接列表 + 创建 Dialog（支持平台/应用/频道 3 种类型）
- `platform/src/pages/Earnings.tsx`（新建）— /earnings 页，开发者/频道主/推广者三 Tab，6 个月月度明细表格
- `platform/src/pages/ReferralLanding.tsx`（新建）— /r/:code 无 Layout 中转页，存 localStorage 后重定向

**修改文件**：
- `platform/src/lib/SDKHost.ts`（修改）— 将 wallet.charge 提取为 walletCharge(params, ctx) 函数，支持 ctx.appDbId + ctx.channelId；charge 后额外写入 app_transactions 触发分润 trigger；createSDKHost 新增第三参数 `context?`，每个连接创建局部 handleSDKRequest 闭包
- `platform/src/components/layout/AppIframe.tsx`（修改）— 新增 appDbId? / channelId? props，传给 createSDKHost
- `platform/src/pages/AppView.tsx`（修改）— 读取 ?channel= query param；传 appDbId + channelId 给 AppIframe；集成 useUserCountry + 地区限制页（Globe 图标）
- `platform/src/contexts/IdentityContext.tsx`（修改）— userId 首次登录时写推广归因（localStorage billai_referral → referral_attributions + promoter_links.register_count）
- `platform/src/App.tsx`（修改）— 新增 ref URL 读取 useEffect；新增路由 /promoter / /earnings / /r/:code
- `platform/src/components/layout/AppSidebar.tsx`（修改）— 新增"推广中心"(TrendingUp)和"收益统计"(DollarSign)导航项

**新建 DB 表**：promoter_links, referral_attributions, promoter_clicks, app_transactions, revenue_splits, role_earnings, user_geo_cache

**新增路由**：`/promoter`、`/earnings`、`/r/:code`

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

---

### 11. Phase 2：应用支付分级管控（app_category + payment_status）

**新建文件**：
- `platform/supabase/migrations/20260304000006_phase2_app_payment.sql`（新建）— `apps` 表新增 `app_category TEXT DEFAULT 'general'` 和 `payment_status TEXT DEFAULT 'pending'` 两列；在 `platform_settings` 中写入支付策略配置（4 条记录），包含：`valid_categories`（合法分类列表）、`restricted_categories`（永久封锁支付的分类）、`default_status_by_category`（新建应用按分类的默认状态）、`charge_error_message`（用户可见错误提示），**全部参数后台可配置、无硬编码**；test-app 自动设为 `payment_status = 'enabled'` 供开发测试

**修改文件**：
- `platform/src/lib/SDKHost.ts`（修改）— `walletCharge` 函数新增支付资格检查：在用户认证后、扣款前，并行查询 `apps.payment_status + app_category` 和 `platform_settings.payment.*`；若 `payment_status !== 'enabled'` 或 `app_category` 在 `restricted_categories` 内，返回 `PAYMENT_RESTRICTED` 错误（错误文案从 `platform_settings` 读取，非硬编码）

**设计原则**：
- 双重封锁：`payment_status = 'restricted'` 或 `app_category ∈ restricted_categories` 任一为真即拒绝
- 默认拒绝：新建应用默认 `payment_status = 'pending'`，管理员审核后才可手动设为 `enabled`
- 分类永久限制：gambling / finance 类别默认永久 restricted，不可通过审核获得平台支付权限
- 兜底回退：平台设置读取失败时回退到内置默认值（["gambling", "finance"]），不会因 DB 故障开放所有支付

**新增/变更 DB 列**：`apps.app_category`、`apps.payment_status`

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

---

### 12. Phase 2：Rich Game 前端 Bill.ai SDK 接入

**文件（Rich Game）**：
- `rich game/frontend/src/lib/billai/` — 新建 SDK 本地副本（types.ts、transport.ts、user.ts、ui.ts、index.ts）
- `rich game/frontend/src/hooks/useBillai.ts` — 新建：BillaiProvider + useBillai hook
- `rich game/frontend/src/main.tsx` — 修改：顶层包裹 `<BillaiProvider>`
- `rich game/frontend/src/components/Navbar.tsx` — 修改：嵌入 Bill.ai iframe 时显示平台用户身份标识
- `rich game/frontend/public/billai.manifest.json` — 新建：Bill.ai App 声明文件
- `rich game/frontend/package.json` — 修改：新增 penpal ^7.0.6 依赖

**文件（平台）**：
- `platform/supabase/migrations/20260304000007_phase2_rich_game_app.sql` — 新建：注册 rich-game 到 apps 表（gambling 类别，payment_status = restricted）

**核心设计**：
- iframe 检测：`window.parent !== window` → 初始化 Penpal SDK → 调用 `billai.user.getInfo()`
- 双重身份：Bill.ai 平台身份（UI 展示）+ 钱包地址（游戏参与）并行，互不干扰
- payment = external：Rich Game 使用自有 USDC/USDT 钱包，不使用 `wallet.charge`，`payment_status = restricted` 永久阻断平台支付
- 优雅降级：SDK 初始化失败（非 iframe、连接超时等）时静默跳过，游戏正常运行
- ✅ `npx tsc --noEmit` 通过（Bill.ai platform）
- ✅ `npm run build` 通过（Bill.ai platform + Rich Game frontend）

**待后续（Phase 3）**：
- Rich Game 后端添加 `/auth/billai` 端点，接受 App Token，实现用户映射
- 完整替换 Reown AppKit 登录流程

---

### 13. Phase 2：应用商店重设计（分类 Tab + 官方徽章）

**新建文件**：
- `platform/supabase/migrations/20260304000008_phase2_app_store_ui.sql`（新建）— `apps` 表新增 `is_official BOOLEAN DEFAULT false` 和 `is_featured BOOLEAN DEFAULT false` 两列；将 `test-app` 和 `rich-game` 标记为官方应用（is_official=true, is_featured=true）；包含 rich-game upsert 兜底（应对 migration 7 未执行的情况）

**修改文件**：
- `platform/src/hooks/useApps.ts`（修改）— `App` 类型新增 `app_category`、`is_official`、`is_featured` 三个字段
- `platform/src/pages/AppStore.tsx`（重写）— 从平铺列表重写为 6 个标签页：推荐 / 游戏 / 工具 / 社交 / 开发者 / 全部；每个 Tab 显示应用数量；AppCard 新增官方徽章（`官方`）、分类彩色标签、18+ 年龄评级标签；提取 AppGrid + AppCardSkeleton 为独立组件

**App Store 标签页逻辑**：
- 推荐：`is_featured || is_official`
- 游戏：`app_category === 'game' || 'gambling'`
- 工具：`app_category === 'tool' || 'general'`
- 社交：`app_category === 'social'`
- 开发者：`!is_official && !!developer_id`（第三方开发者上传）
- 全部：所有已审核应用

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

**用户操作**：需执行 `supabase db push` 或在 Supabase Dashboard 运行 migration 20260304000008 后，Rich Game 才会出现在商店推荐 Tab 中

---

### 6. 认证系统改进：邮箱验证 UX + Google/Apple OAuth

**文件**：`platform/src/pages/Auth.tsx`（修改）、`docs/ADMIN_SETTINGS_REGISTRY.md`（新建）、`CLAUDE.md`（修改）

- 注册成功后显示专用验证确认界面（替代简单 toast）
- 显示邮件已发送 + 邮箱地址遮蔽（`te***@gmail.com`）+ 步骤指引
- 添加"重新发送验证邮件"按钮（60 秒冷却倒计时）
- 添加"打开邮箱"快捷链接（自动识别 Gmail/QQ/163/Outlook 等主流邮箱）
- 登录时"邮箱未验证"错误自动跳转到验证确认界面
- 添加 Google 和 Apple OAuth 登录按钮（登录 + 注册两个 tab 均显示）
- Google/Apple OAuth 按钮使用标准品牌样式，支持 dark mode
- 可变参数（冷却时间、密码长度等）提取为常量，不硬编码进逻辑
- 副标题从"AI 社交平台"更新为"AI 时代的应用工厂"
- 建立"后台可配置项注册表"机制（`docs/ADMIN_SETTINGS_REGISTRY.md`）
- 更新 CLAUDE.md 开发流程，新增第 8 步"更新可配置项注册表"

---

### 14. 两级授权模型：App-scoped OpenID

**新建文件**：
- `platform/supabase/migrations/20260305000000_app_user_openids.sql`（新建）— `app_user_openids` 表 + `get_or_create_openid()` SECURITY DEFINER 函数

**修改文件**：
- `packages/sdk/src/types.ts`（修改）— `UserInfo` 接口：`id`/`displayName` → `openid`/`nickname`
- `platform/src/lib/SDKHost.ts`（修改）— `getInfo()` 改为 context-aware，调用 `get_or_create_openid` RPC 返回 app-scoped openid；`ChargeContext` → `SDKContext`
- `platform/supabase/functions/issue-app-token/index.ts`（修改）— JWT payload `sub` 从真实 user_id 改为 openid
- `rich game/frontend/src/lib/billai/types.ts`（修改）— 同步 `UserInfo` 类型变更
- `rich game/frontend/src/components/Navbar.tsx`（修改）— `displayName` → `nickname`

**设计决策**：
- 每个用户在每个应用获得独立的 `openid`（前缀 `ou_`），防止跨应用追踪
- 卸载/重装 openid 不变（独立于 `user_installed_apps`）
- 基础信息（openid + nickname + avatar）静默授权，无弹窗
- 敏感操作（支付等）由平台弹窗确认（已有 `PermissionRequestDialog` 框架）
- App Token JWT 中 `sub` 为 openid，应用后端无法获取真实 user_id

**新增 DB 表**：`app_user_openids`
**新增 DB 函数**：`get_or_create_openid(p_user_id, p_app_id)`

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ supabase db push 通过

---

### 15. 导航重构：5-Tab + 全屏应用模式 + 响应式布局

**新建文件**：
- `platform/src/components/layout/AppNavigation.tsx`（新建）— 5-Tab 响应式导航组件，替代原 14 项侧边栏
- `platform/src/components/layout/AppFullScreen.tsx`（新建）— 浮动 [B] 返回按钮，用于全屏应用模式
- `platform/src/pages/Me.tsx`（新建）— 「我的」聚合页：个人资料、设置、隐私、好友、创作者工具、管理（按角色显示）
- `platform/src/pages/AI.tsx`（新建）— AI 助手占位页，含建议快捷词 + 输入框

**修改文件**：
- `platform/src/App.tsx`（修改）— 路由重构：`/` 重定向到 `/conversations`；新增 `/ai`、`/me` 路由；`/app/:appId` 移出 MainLayout（全屏模式）；移除 Index 页面导入
- `platform/src/components/layout/MainLayout.tsx`（修改）— AppSidebar → AppNavigation；桌面端左侧栏 + 移动端底部 Tab 栏；移动端内容区添加 `pb-14` 避开底部导航
- `platform/src/components/layout/TopHeader.tsx`（修改）— 高度 h-14 → h-12；移动端隐藏前进/后退按钮和主题切换
- `platform/src/pages/AppView.tsx`（修改）— 移除平台强加的应用名称/版本头栏，iframe 直接占满全屏

**5-Tab 结构**：
| 位置 | Tab | 路由 | 图标 |
|------|-----|------|------|
| 1 | 消息 | /conversations | MessageSquare |
| 2 | 动态 | /feed | Compass |
| 3 | **AI** | /ai | Sparkles（中心特殊按钮） |
| 4 | 应用 | /store | LayoutGrid |
| 5 | 我的 | /me | User |

**响应式**：
- 桌面 (>=768px)：左侧 64px 窄边栏，竖排图标+文字
- 移动 (<768px)：底部固定 Tab 栏，横排 5 图标
- AI 按钮居中，圆形特殊样式（active 时实心 primary 色）

**全屏应用模式**：
- `/app/:appId` 不再包裹 MainLayout → 无侧栏、无顶栏
- 仅显示浮动 [B] 按钮（左上角，32px 圆形，半透明）
- 点击 [B] 返回 `/store`

**删除/废弃**：
- `AppSidebar.tsx` 不再被导入（可删除），原 14 项菜单缩减为 5 Tab + 子页面
- `Index.tsx` 不再被路由引用（`/` 直接重定向）

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

---

### 16. 平台基础设施加固（P0-P4）

**新建文件**：
- `platform/src/components/RequireAuth.tsx`（新建）— 认证守卫组件，检查 Supabase session，未登录重定向到 `/auth`，支持 offline 模式跳过

**修改文件**：
- `platform/src/App.tsx`（修改）— 所有 28 个页面改为 `React.lazy()` 动态导入 + `Suspense` 包裹；新增 `ProtectedPage` 组件组合 `RequireAuth` + `MainLayout` + `Suspense`；公开路由（`/auth`、`/r/:code`）不加认证守卫
- `platform/src/pages/MessagingCenter.tsx`（修改）— 移动端响应式：左侧面板全宽、右侧面板全宽 + 返回按钮，同时只显示一个面板；桌面端保持双面板布局
- `platform/src/components/layout/SmartSearchBar.tsx`（修改）— 修复 Realtime payload `any` 类型为 `{ new: Record<string, unknown> }`

**效果**：
- 路由代码分割：主 bundle 从 ~1.3MB 降至 660KB，各页面独立 chunk（`MessagingCenter` 152KB、`Feed` 13KB 等）
- 认证守卫：未登录用户访问任何受保护路由自动跳转 `/auth`
- 移动端消息：w-80 固定宽度改为响应式，移动端显示单面板 + 返回导航
- ESLint 错误清零（1 error → 0 error）

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

---

### 17. i18n 国际化基础设施搭建

**新建文件**：
- `platform/src/lib/i18n.ts`（新建）— i18next 配置，HttpBackend 加载翻译 JSON，LanguageDetector 自动检测语言（localStorage > navigator），fallback 中文
- `platform/public/locales/zh/translation.json`（新建）— 中文翻译文件，覆盖 nav/auth/common/feed/messaging/me/store/ai 共 34 个 key
- `platform/public/locales/en/translation.json`（新建）— 英文翻译文件，同结构 34 个 key
- `platform/src/components/LanguageSwitcher.tsx`（新建）— 语言切换下拉组件，使用 shadcn Select，支持中文/English 切换

**修改文件**：
- `platform/src/main.tsx`（修改）— 添加 `import '@/lib/i18n'` 初始化国际化（仅新增一行 import）

**依赖新增**：react-i18next、i18next、i18next-browser-languagedetector、i18next-http-backend

**说明**：
- 本次仅搭建基础设施，未替换现有组件中的硬编码文字
- 翻译 key 使用嵌套对象结构（`nav.messages`、`common.loading` 等）
- LanguageSwitcher 组件已就绪，可在需要时集成到 TopHeader 或设置页
- 后续任务：逐步将各页面/组件的硬编码文字替换为 `t('key')` 调用

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

---

### 18. Feed 聚合 MVP（冷启动内容）

**新建文件**：
- `platform/supabase/migrations/20260306000000_feed_aggregation.sql`（新建）— `aggregated_feed` + `feed_sources` 表，公开读 RLS，默认 3 个数据源（HN Top + Reddit r/technology + r/programming）
- `platform/supabase/functions/fetch-aggregated-feed/index.ts`（新建）— Deno Edge Function，拉取 HN topstories（前 30）+ Reddit hot 帖子，upsert 到 aggregated_feed 表，使用 service role key 写入
- `platform/src/hooks/useAggregatedFeed.ts`（新建）— React Query hook，查询 aggregated_feed 表，支持按 source 过滤，staleTime 5 分钟

**修改文件**：
- `platform/src/pages/Feed.tsx`（修改）— 新增"发现" Tab 作为第一个 Tab（原 4 Tab → 5 Tab）；发现 Tab 显示聚合内容卡片（来源图标 + 标题 + 摘要 + 原文链接 + 时间）；支持按来源过滤（全部/HN/Reddit）；点击卡片新窗口打开原文；底部"查看更多"按钮；骨架屏加载态；空态提示

**新建 DB 表**：`aggregated_feed`、`feed_sources`

**架构参考**：`docs/architecture/24-feed-aggregation.md`

**设计决策**：
- 聚合表使用 `(supabase as any).from(...)` 绕过自动生成类型限制（表不在 types.ts 中）
- Edge Function 使用 `SUPABASE_SERVICE_ROLE_KEY` 绕过 RLS 写入
- HN 并行拉取（每批 10 条），Reddit 设置自定义 User-Agent 避免 429
- 发现 Tab 默认选中，为冷启动提供首屏内容

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

---

### 19. 测试基础设施搭建（Vitest）

**新建文件**：
- `platform/vitest.config.ts`（新建）— Vitest 配置，jsdom 环境，globals 模式，v8 覆盖率，排除 ui/integrations 目录
- `platform/src/__tests__/setup.ts`（新建）— 测试 setup，Supabase 全局 mock，window.matchMedia mock，afterEach cleanup
- `platform/src/__tests__/utils.test.ts`（新建）— cn() 工具函数示范测试（3 cases）
- `platform/src/__tests__/RequireAuth.test.tsx`（新建）— RequireAuth 组件示范测试（3 cases：loading/authed/redirect）

**修改文件**：
- `platform/package.json`（修改）— 新增 test/test:watch/test:coverage scripts；新增 devDependencies：vitest、@testing-library/react、@testing-library/jest-dom、@testing-library/user-event、@testing-library/dom、jsdom、@vitest/coverage-v8

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ npm test 通过（2 suites, 6 tests）

---

### 20. CI/CD 管线搭建（GitHub Actions）

**新建文件**：
- `.github/workflows/ci.yml`（新建）— 三阶段 CI：lint-and-typecheck → build → test；Node 20 + npm ci；build artifact 上传供 test 阶段使用
- `.github/pull_request_template.md`（新建）— PR 模板，含变更类型 checkbox + 测试清单
- `.github/ISSUE_TEMPLATE/bug_report.yml`（新建）— Bug 报告模板
- `.github/ISSUE_TEMPLATE/feature_request.yml`（新建）— 功能请求模板
- `.github/dependabot.yml`（新建）— 每周自动检测 npm 依赖更新

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

---

### 21. 发现 Tab 内容质量优化

**修改文件**：
- `platform/src/hooks/useAggregatedFeed.ts`（修改）— 客户端 fallback 从单一 r/technology 扩展到 4 个新闻向子版（worldnews、news、science、technology），并行拉取；每个源 8 条以保持多样性
- `platform/src/pages/Feed.tsx`（修改）— 卡片重设计为新闻应用风格：移除 Card 组件包裹改用 border-b 分割；新增分类标签（国际/新闻/科学/科技/编程）带颜色编码；标题字号加大 + hover 变色；热度数字格式化（1000 → 1.0k）；筛选按钮添加图标；移除未使用的 Card/Badge/Clock 导入

**内容改进**：
- 增加新闻覆盖面：worldnews（国际）、news（新闻）、science（科学）+ 原有 technology
- 分类标签颜色编码：红色=国际/新闻、紫色=科学、蓝色=科技、绿色=编程
- 卡片 UX：hover 高亮、更紧凑的 meta 行、热度格式化

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

---

### 22. 新闻聚合系统 v2：RSS 通用解析 + 后台管理 + 多源预置

**新建文件**：
- `platform/supabase/migrations/20260306100000_feed_sources_upgrade.sql`（新建）— feed_sources 表新增 source_url/category/language/icon_url/description/item_count/error_count/last_error 字段；管理员写入 RLS；预置 19 个 RSS 源（BBC/Reuters/AP/TechCrunch/Ars Technica/The Verge/Wired/Nature/CNBC/少数派/36氪/V2EX/InfoQ/澎湃 + Reddit worldnews/science）
- `platform/src/components/admin/FeedSourcesManager.tsx`（新建）— 新闻源 CRUD 管理组件：源列表（开关/分类/类型/语言/状态/错误信息）；添加/编辑 Dialog（名称/类型/分类/语言/URL/抓取间隔/条数/描述）；一键触发抓取按钮；删除确认

**修改文件**：
- `platform/supabase/functions/fetch-aggregated-feed/index.ts`（重写）— 新增通用 RSS XML 解析器（deno_dom DOMParser）；支持 RSS 2.0 + Atom 格式；图片提取链：media:content → media:thumbnail → enclosure → description 内 img 标签；保留 HN/Reddit 专用解析器；5 并发批量处理 + 10s 超时；错误记录到 feed_sources（error_count/last_error）
- `platform/src/pages/Admin.tsx`（修改）— 导入并集成 FeedSourcesManager 组件
- `platform/src/pages/Feed.tsx`（修改）— 筛选从 source 类型（hackernews/reddit）改为 category 分类（新闻/科技/科学/财经）；图标更新（Newspaper/FlaskConical/TrendingUp）
- `platform/src/hooks/useAggregatedFeed.ts`（修改）— DB 查询从 `eq("source")` 改为 `contains("tags", [category])` 支持分类过滤；limit 30 → 40

**预置 RSS 源（19 个）**：

| 分类 | 源 | 语言 |
|------|-----|------|
| 新闻 | BBC World / Reuters / AP News / Al Jazeera / 澎湃新闻 | en/zh |
| 科技 | TechCrunch / Ars Technica / The Verge / Wired / 少数派 / 36氪 / V2EX / InfoQ | en/zh |
| 科学 | Nature News / Science Daily | en |
| 财经 | CNBC Top News | en |
| Reddit | r/worldnews / r/science | en |

**架构**：RSSHub 公共实例用于无原生 RSS 的中文站（36氪/V2EX/InfoQ/澎湃/AP News）

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

### 11. 发现页七大优化（Phase 1-5）

**文件**：
- `supabase/migrations/20260306400000_feed_stagger.sql`（新建）
- `supabase/migrations/20260306400001_feed_normalization.sql`（新建）
- `supabase/migrations/20260306400002_feed_categories.sql`（新建）
- `supabase/migrations/20260306500000_feed_dedup.sql`（新建）
- `supabase/migrations/20260306600000_feed_interactions.sql`（新建）
- `supabase/migrations/20260306700000_feed_translations.sql`（新建）
- `supabase/functions/fetch-aggregated-feed/index.ts`（修改）
- `supabase/functions/translate-feed-items/index.ts`（新建）
- `src/hooks/useAggregatedFeed.ts`（重写）
- `src/hooks/useFeedCategories.ts`（新建）
- `src/hooks/useFeedInteractions.ts`（新建）
- `src/hooks/useFeedTranslation.ts`（新建）
- `src/pages/Feed.tsx`（修改）
- `src/components/admin/FeedSourcesManager.tsx`（修改）

**Phase 1A — 分批抓取**：
- feed_sources 新增 batch_group 列，6 组轮转分配
- Edge Function 支持 `{ batch_group: N }` 参数过滤
- 尊重 fetch_interval_minutes，跳过刚抓取过的源

**Phase 1B — 内容规范化**：
- aggregated_feed 新增 normalized_title, content_hash, reading_time_minutes, raw_content
- normalizeItem() 函数：清洗标题、FNV-1a 哈希、阅读时间估算
- pg_trgm GIN 索引加速模糊匹配

**Phase 1C — 全品类标签**：
- feed_categories 表：16 个动态分类（news/tech/ai/science/finance/crypto/politics/sports...）
- useFeedCategories hook + getCategoryColorClasses 颜色映射
- Feed.tsx 发现页筛选标签从硬编码改为 DB 动态加载（最多显示前 8 个）
- FeedSourcesManager 分类下拉改为动态加载
- **优化**：Feed chunk 从 751KB → 24KB（移除 `import * as LucideIcons`，改用静态 ICON_MAP）

**Phase 2 — 去重与相似新闻聚合**：
- feed_clusters + feed_cluster_items 表
- cluster_feed_items() PL/pgSQL 函数：content_hash 精确匹配 + pg_trgm 模糊匹配（similarity > 0.4）
- deduplicated_feed 视图：每个 cluster 显示评分最高的文章 + similar_count
- useAggregatedFeed 优先读 deduplicated_feed 视图
- useSimilarArticles hook + SimilarArticlesSheet 底部面板（"N 篇相似报道"）

**Phase 3 — 性能优化**：
- useAggregatedFeed 改为 useInfiniteQuery + 游标分页（cursor = published_at）
- 每页 25 条 + "加载更多" 按钮
- Feed.tsx 渲染层适配 infinite query 数据结构

**Phase 4 — 互动机制**：
- feed_item_likes + feed_item_bookmarks 表（RLS: 公开读/本人写）
- aggregated_feed 新增 like_count, bookmark_count + 自动触发器
- useFeedItemStatus 批量查询用户点赞/收藏状态
- useFeedLike / useFeedBookmark 乐观更新
- DiscoverFeedCard 底部增加 ❤️ + 🔖 按钮

**Phase 5 — i18n 翻译**：
- feed_translations 表（feed_id + target_lang 唯一约束）
- translate-feed-items Edge Function（DeepLX 免费 API，批量翻译缓存）
- useFeedTranslation hook（按需翻译 + 本地缓存）
- 发现页筛选栏增加翻译切换按钮（Languages 图标）

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ 所有迁移已推送到远端
- ✅ fetch-aggregated-feed + translate-feed-items 已部署

---

### 23. 用户语言偏好 + 新闻语言过滤

**新建文件**：
- `platform/supabase/migrations/20260306800000_user_preferred_language.sql`（新建）— profiles 表新增 `preferred_language TEXT DEFAULT 'zh'` 列 + 索引

**修改文件**：
- `platform/src/pages/UserSettings.tsx`（修改）— 新增语言选择器（Globe 图标 + Select 下拉），支持 🇨🇳 中文 / 🇺🇸 English；加载时从 DB 读取 preferred_language 同步到 i18n；保存时双向同步（DB + i18n）
- `platform/src/hooks/useAggregatedFeed.ts`（修改）— `useAggregatedFeed(category?, language?)` 新增 language 参数；`fetchFeedPage` 使用 `.eq("language", language)` 过滤；HN fallback 仅在 English 或无过滤时触发
- `platform/src/pages/Feed.tsx`（修改）— 读取 `i18n.language` 作为 contentLang 传入 `useAggregatedFeed` 和 `useFeedTranslation`
- `platform/public/locales/zh/translation.json`（修改）— 新增 settings.language 等 key
- `platform/public/locales/en/translation.json`（修改）— 同上英文版

**新增 DB 列**：`profiles.preferred_language`

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

---

### 24. Admin 后台管理系统（Shell + 仪表盘 + 迁移现有功能）

**新建文件（11 个）**：
- `platform/src/components/admin/AdminGuard.tsx`（新建）— Admin 角色校验，React Query 查 user_roles，非 admin 显示拒绝页
- `platform/src/components/admin/AdminLayout.tsx`（新建）— Shell：固定侧栏(w-64) + 头部 + `<Outlet />`，移动端 Sheet 侧栏
- `platform/src/components/admin/AdminSidebar.tsx`（新建）— 7 模块层级导航（总览/消息/动态/应用/用户/财务/系统），shadcn Collapsible + ScrollArea，活跃项圆点指示器，"待开发"灰色徽标
- `platform/src/components/admin/AdminHeader.tsx`（新建）— 面包屑导航（pathname → 中文标签映射）+ 移动端汉堡菜单 + 返回平台按钮
- `platform/src/components/admin/StatCard.tsx`（新建）— 统计卡片组件（icon + label + monospace 大号数字 + description），hover 效果
- `platform/src/components/admin/ComingSoon.tsx`（新建）— 待开发占位页（Construction 图标）
- `platform/src/hooks/useAdminStats.ts`（新建）— 3 个 React Query hooks：useAdminStats（平台统计 count）、useUserGrowth（30 天注册趋势）、useFeedSourceHealth（错误最多的源 top 10）
- `platform/src/pages/admin/AdminOverview.tsx`（新建）— 仪表盘：4 个 StatCard（用户/帖子/新闻/源）+ Recharts AreaChart 用户增长图 + 新闻源健康面板 + 平台快照面板
- `platform/src/pages/admin/AdminBanManagement.tsx`（新建）— 从原 Admin.tsx 提取封禁管理功能
- `platform/src/pages/admin/AdminPlatformSettings.tsx`（新建）— 从原 Admin.tsx 提取 Groq Whisper 配置
- `platform/src/pages/admin/AdminFeedSources.tsx`（新建）— FeedSourcesManager 包装页

**修改文件（3 个）**：
- `platform/src/pages/Admin.tsx`（修改）— 简化为 `<Navigate to="/admin/overview" replace />`
- `platform/src/App.tsx`（修改）— 旧 `/admin` 单路由 → `/admin/*` 嵌套路由（AdminGuard > AdminLayout > 子页面），全部 lazy 加载
- `platform/src/pages/Me.tsx`（修改）— "平台管理"链接更新为 `/admin/overview`

**新增路由**：
| 路径 | 页面 |
|------|------|
| `/admin` | → 重定向 `/admin/overview` |
| `/admin/overview` | 仪表盘 |
| `/admin/content/discover/sources` | 新闻源管理 |
| `/admin/users/bans` | 封禁管理 |
| `/admin/system/settings` | 平台设置 |
| `/admin/*` | 待开发占位页 |

**导航结构（7 模块）**：
- 📊 总览 → 仪表盘
- 💬 消息管理 → 对话/群聊（待开发）
- 📰 动态管理 → 帖子/评论（待开发）+ 新闻源管理 + 分类（待开发）
- 📱 应用管理 → 应用商店（待开发）
- 👥 用户管理 → 用户列表（待开发）+ 封禁管理
- 💰 财务管理 → 收入概览（待开发）
- ⚙️ 系统设置 → 平台设置 + 管理员账号（待开发）

**设计**：Admin 路由绕过 MainLayout（不显示 5-Tab 底栏），独立 Shell 布局

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ ESLint 无新增错误

---

### 25. 新闻管理后台完善（6 大模块）

**新建文件（18 个）**：

**数据库迁移**：
- `platform/supabase/migrations/20260307000000_feed_article_moderation.sql`（新建）— aggregated_feed 新增 status/comment_count 列 + admin RLS；创建 feed_item_reports 表（举报系统）；创建 feed_item_comments 表（评论系统）+ comment_count 自动触发器

**页面（5 个）**：
- `platform/src/pages/admin/AdminFeedDashboard.tsx`（新建）— 新闻数据看板页
- `platform/src/pages/admin/AdminFeedArticles.tsx`（新建）— 文章管理页
- `platform/src/pages/admin/AdminFeedCategories.tsx`（新建）— 分类管理页
- `platform/src/pages/admin/AdminFeedReports.tsx`（新建）— 举报审核页
- `platform/src/pages/admin/AdminFeedInteractions.tsx`（新建）— 互动管理页

**组件（4 个）**：
- `platform/src/components/admin/FeedCategoriesManager.tsx`（新建）— 分类 CRUD：排序上下移、icon/color 选择器、active 开关
- `platform/src/components/admin/FeedArticlesManager.tsx`（新建）— 文章管理：多维筛选 + Table + 分页 + 详情/编辑 Dialog + 批量操作
- `platform/src/components/admin/FeedReportQueue.tsx`（新建）— 举报审核队列：统计卡、Tab 过滤、处理操作（批准/隐藏/驳回）
- `platform/src/components/admin/FeedInteractionsManager.tsx`（新建）— 互动管理：评论列表 + 点赞统计 + 收藏统计三 Tab
- `platform/src/components/admin/FeedDashboardCharts.tsx`（新建）— 数据看板：4 统计卡 + 文章趋势 AreaChart + 分类/来源 BarChart + Top 10 文章

**Hooks（4 个）**：
- `platform/src/hooks/useAdminFeedArticles.ts`（新建）— 分页查询 + 多维过滤 + 来源列表
- `platform/src/hooks/useAdminFeedReports.ts`（新建）— 举报列表/统计/处理 mutation
- `platform/src/hooks/useAdminFeedComments.ts`（新建）— 评论分页 + 软删除 + 点赞/收藏排行
- `platform/src/hooks/useAdminFeedAnalytics.ts`（新建）— 看板统计 + 30 天趋势 + 分类/来源分布 + Top 文章

**修改文件（4 个）**：
- `platform/src/App.tsx`（修改）— 新增 5 个 lazy import + 5 个 admin 子路由
- `platform/src/components/admin/AdminSidebar.tsx`（修改）— 动态管理新增 5 个子导航（新闻概览/文章管理/分类管理/举报审核/互动管理），移除分类的 comingSoon 标记
- `platform/src/components/admin/AdminHeader.tsx`（修改）— 新增 4 个 segment label（articles/reports/interactions/dashboard）
- `platform/src/components/admin/FeedSourcesManager.tsx`（修改）— 新增语言过滤栏（全部/中文/English）、抓取设置面板（批量启用/禁用/重置错误）、错误 Tooltip 完整展示、单源重试按钮

**新增 DB 表**：`feed_item_reports`、`feed_item_comments`
**新增 DB 列**：`aggregated_feed.status`、`aggregated_feed.comment_count`

**6 大功能模块**：
1. 新闻源管理增强 — 语言过滤 + 抓取设置面板 + 错误优化
2. 分类管理 — CRUD + 排序 + icon/color 选择器
3. 文章管理 — 搜索/筛选 + Table + 分页 + 详情/编辑 + 批量操作
4. 举报审核 — 统计卡 + 队列 + 批准/隐藏/驳回 + 处理备注
5. 互动管理 — 评论管理 + 点赞统计 + 收藏统计
6. 数据看板 — 统计概览 + Recharts 图表 + Top 10

**新增路由**：
| 路径 | 页面 |
|------|------|
| `/admin/content/discover/dashboard` | 新闻概览 |
| `/admin/content/discover/articles` | 文章管理 |
| `/admin/content/discover/categories` | 分类管理 |
| `/admin/content/discover/reports` | 举报审核 |
| `/admin/content/discover/interactions` | 互动管理 |

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过

### 18. 平台语言管理系统 + zh → zh-CN/zh-TW 迁移

**新建的文件**：
- `platform/supabase/migrations/20260307200000_platform_languages.sql`（新建）— platform_languages 表 + RLS + zh/en 种子
- `platform/supabase/migrations/20260307200001_seed_all_languages.sql`（新建）— 预置 16 种额外语言
- `platform/supabase/migrations/20260307200002_refine_languages.sql`（新建）— 精简为 13 种语言，zh 拆分为 zh-CN/zh-TW，迁移旧数据
- `platform/src/hooks/usePlatformLanguages.ts`（新建）— 6 个 React Query hooks（查询/开关/排序/增删）
- `platform/src/components/admin/LanguageManager.tsx`（新建）— 后台语言管理组件（开关 + 排序）
- `platform/public/locales/zh-CN/translation.json`（新建）— 简体中文翻译
- `platform/public/locales/zh-TW/translation.json`（新建）— 繁体中文翻译

**修改的文件**：
- `platform/src/pages/admin/AdminPlatformSettings.tsx`（修改）— 集成 LanguageManager 组件
- `platform/src/pages/UserSettings.tsx`（修改）— 删除硬编码 LANGUAGE_OPTIONS，改用 useEnabledLanguages()，默认语言 zh → zh-CN
- `platform/src/components/LanguageSwitcher.tsx`（修改）— 改用 useEnabledLanguages() 动态数据
- `platform/src/components/admin/FeedSourcesManager.tsx`（修改）— 语言过滤/显示改用 usePlatformLanguages()，默认 zh → zh-CN
- `platform/src/components/admin/FeedArticlesManager.tsx`（修改）— 语言过滤/显示改用 usePlatformLanguages()，移除硬编码 LANGUAGE_OPTIONS
- `platform/src/hooks/useFeedTranslation.ts`（修改）— 默认 targetLang zh → zh-CN
- `platform/src/pages/Feed.tsx`（修改）— contentLang 映射 zh → zh-CN
- `platform/src/lib/i18n.ts`（修改）— fallbackLng/supportedLngs 增加 zh-CN, zh-TW

**语言列表**（13 种，3 种默认启用）：
- zh-CN 简体中文 / zh-TW 繁體中文 / en English（启用）
- ja / ko / es / fr / de / pt / ru / ar / vi / th（禁用）

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ 数据库迁移已推送

### 19. 多语言 RSS 源批量导入（112 个新源）

**新建的文件**：
- `platform/supabase/migrations/20260307300000_multilingual_feeds.sql`（新建）— 12 种语言 112 个 RSS 源

**数据来源**：
- [awesome-rss-feeds](https://github.com/plenaryapp/awesome-rss-feeds) — 按国家分类的 RSS 合集
- [BBC World Service](https://github.com/bbc/world-service-rss) — BBC 多语言 RSS
- 各国主流媒体官方 RSS

**各语言源数**：
| 语言 | 数量 | 代表来源 |
|------|------|----------|
| zh-CN 简体 | 13 | BBC中文、新华网、澎湃、财新、36氪、知乎、虎嗅 |
| zh-TW 繁體 | 14 | BBC繁體、中央社(5)、聯合、自由、ETtoday、關鍵評論網 |
| ja 日本語 | 10 | BBC Japanese、NHK(5)、Nikkei、ITmedia |
| ko 한국어 | 9 | BBC Korean、朝鮮、中央、韓聯、SBS、東亞 |
| es Español | 10 | BBC Mundo、EL PAÍS、Infobae、France24 ES、DW ES |
| fr Français | 9 | Le Monde、France24、Franceinfo、RFI、La Presse |
| de Deutsch | 8 | ZEIT、FAZ、Spiegel、Heise、Golem、Handelsblatt |
| pt Português | 8 | BBC Brasil、Folha、R7、UOL、Público、Observador |
| ru Русский | 8 | BBC Russian、ТАСС、Lenta、РИА、Хабр |
| ar العربية | 8 | BBC Arabic、Al Jazeera、Al Arabiya、Asharq Al-Awsat |
| vi Tiếng Việt | 9 | BBC Vietnamese、VnExpress(5)、Thanh Niên |
| th ไทย | 6 | BBC Thai、Bangkok Post(3)、Nation Thailand |

**总计**：原 86 源 + 新增 112 源 ≈ 198 个 RSS 源
- ✅ 数据库迁移已推送

### 20. RSS 全文提取 + 图片本地化（Strategy B）

**文件**：
- `platform/supabase/migrations/20260307400000_full_content_extraction.sql`（新建）
- `platform/supabase/functions/extract-full-article/index.ts`（新建）
- `platform/supabase/functions/fetch-aggregated-feed/index.ts`（修改：截断 500→2000）
- `platform/src/hooks/useAggregatedFeed.ts`（修改：新增 full_content 等字段类型）
- `platform/src/hooks/useAdminFeedArticles.ts`（修改：新增提取字段类型）
- `platform/src/pages/Feed.tsx`（修改：全文渲染 + 视频嵌入 + HTML 净化）
- `platform/src/components/admin/FeedArticlesManager.tsx`（修改：提取状态列 + 重提取按钮）
- `platform/tailwind.config.ts`（修改：添加 @tailwindcss/typography 插件）

**功能**：
- 数据库: aggregated_feed 新增 full_content, full_content_status, images, videos, word_count 等列
- 数据库: 新建 feed_media 表追踪已下载图片
- 数据库: 新建 feed-media Storage bucket（公开读）
- Edge Function `extract-full-article`: 使用 @extractus/article-extractor 提取全文 HTML
- 图片下载到 Supabase Storage 并替换 HTML 中的 URL
- 视频嵌入链接提取（YouTube/Vimeo/MP4）
- 前端: FeedDetailPanel 支持全文 HTML 渲染（prose 排版 + HTML 净化）
- 前端: 视频嵌入组件（YouTube iframe / MP4 video）
- Admin: 文章列表新增「提取」状态列（待提取/已提取/失败/跳过）
- Admin: 「全文提取」批量触发按钮 + 单篇重新提取按钮
- Admin: 文章详情展示提取状态、字数、错误信息

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ 数据库迁移已推送
- ✅ Edge Function 已部署（extract-full-article + fetch-aggregated-feed）

---

### 21. 文章管理 UI 修复 + 站内查看链接

**文件**：
- `platform/src/components/admin/FeedArticlesManager.tsx`（修改）
- `platform/src/pages/Feed.tsx`（修改）

- 顶部操作栏文字换行修复：添加 `whitespace-nowrap`、`flex-shrink-0`、`gap-3`
- 文章详情弹窗「原文链接」右侧新增「站内查看」按钮：点击关闭弹窗 + 跳转 `/feed?article={id}`
- Feed 发现页读取 `?article=ID` query param，自动从 Supabase 查询该文章并弹出详情面板
- 导入 `useNavigate`、`useSearchParams`、`supabase` 客户端

---

### 22. 新闻源管理三项改进（Switch + 单源抓取 + 进度可视化）

**文件**：
- `platform/supabase/migrations/20260307500000_feed_sources_improvements.sql`（新建）
- `platform/supabase/functions/fetch-aggregated-feed/index.ts`（修改）
- `platform/src/components/admin/FeedSourcesManager.tsx`（完全重写）

**数据库**：
- `feed_sources` 新增 `total_item_count INT DEFAULT 0`（累计抓取数，不覆盖）

**Edge Function**：
- 新增 `source_id` 参数：单源定向抓取
- 新增 `force` 参数：跳过间隔检查
- 并发改为串行：`CONCURRENCY = 1`（原 5）
- `total_item_count` 累加（原 `item_count` 每次覆盖）

**FeedSourcesManager 重写**：
- is_active 切换改用 `<Switch>` 组件（替代圆形 toggle 按钮）
- 每个源右侧新增绿色「立即抓取」按钮（`RefreshCw`），带单源 loading 状态
- 源卡片信息行新增：累计抓取数（`total_item_count`）、下次抓取倒计时（`getNextFetchIn`）
- 全量抓取期间 2s 轮询，进度条实时更新（`completedCount / total`）
- 进度文字：「X / N 个源已完成（串行队列）」+ 「当前: [源名]」

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ✅ 数据库迁移已推送
- ✅ Edge Function 已重新部署

### 23. 自动全文提取 + 文章图片质量优化

**文件**：
- `.github/workflows/scheduled-feed-fetch.yml`（修改）
- `platform/src/pages/Feed.tsx`（修改）

**根本问题**：`extract-full-article` Edge Function 存在但从未自动触发，所有文章永远停在 `full_content_status = 'pending'`，用户只能看到 2-3 句 RSS 摘要。

**GitHub Actions 自动化**：
- 现有 workflow 每批次 fetch 结束后自动追加「Trigger article extraction」步骤
- 调用 `extract-full-article` 处理 10 篇 pending 文章（best-effort，失败不影响 feed fetch）
- 新增 `skip_extraction` 手动触发参数，可跳过提取步骤

**Feed.tsx 图片质量优化**：
- 解析文章 `images[]` JSONB 字段（提取后存储在 Supabase Storage，高清）
- `heroImage` 优先使用 `images[0].url`（Supabase Storage），fallback 到 RSS thumbnail
- 图片加载失败时自动降级：Supabase 图片 → RSS thumbnail → 隐藏
- hero 图片高度从 `max-h-[300px]` 扩展到 `max-h-[360px]`
- 全文提取中（pending）：正文下显示「正在提取全文」提示 + 「阅读原文」链接
- 提取失败（failed）：显示「无法提取全文」提示 + 「阅读原文」链接

- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ⚠️ 需部署 extract-full-article Edge Function（若尚未部署）

### 22. Jina Reader 全文提取 + 修复抓取 0 条内容

**文件**：`platform/supabase/functions/extract-full-article/index.ts`（重写）、`platform/src/pages/Feed.tsx`（修改）、`platform/src/components/admin/FeedSourcesManager.tsx`（修改）、`.github/workflows/scheduled-feed-fetch.yml`（修改）

**全文提取引擎升级（Jina Reader）**：
- 移除无效的 `@extractus/article-extractor`（被 Cloudflare/paywall 拦截），改用 Jina Reader API（`r.jina.ai`）
- 调用 `https://r.jina.ai/{url}` 获取 Markdown 全文，`marked` 库转 HTML
- 自动下载文章图片并上传至 Supabase Storage（最多 10 张，最大 5MB/张）
- 提取视频嵌入（YouTube / Vimeo）
- 响应内容 <200 字符视为 paywall/封锁，标记 `failed`
- 部署命令：`supabase functions deploy extract-full-article --no-verify-jwt`（新项目使用 `sb_publishable_*` key，非 JWT 格式）

**Feed.tsx 用户体验改进**：
- 移除 pending/failed 提取状态提示（用户侧不应看到"正在提取全文"状态）
- `stripHtml` 增强：清理 `&zwnj;` 等零宽字符实体和所有 HTML 实体编码

**FeedSourcesManager.tsx 修复**：
- 全量抓取（"立即抓取"）默认传 `force: true`，避免因间隔检查跳过近期已抓取的源导致"共获取 0 条内容"

**已验证**：
- ✅ 澎湃新闻：11,000 字符全文提取成功
- ✅ 한겨레（韩国）：5,310 词 + 10 张图片提取并上传 Supabase Storage
- ⚠️ Bangkok Post：付费墙，Jina 无法穿透，建议在管理后台停用
- ⚠️ Reuters：Jina 服务器地理封锁，返回 451

**GitHub Actions 自动化**：
- `scheduled-feed-fetch.yml` 已在每次 feed 抓取后自动触发 `extract-full-article`（非致命，失败输出 warning）
- 需要在 GitHub Secrets 中配置：`SUPABASE_URL`、`SUPABASE_ANON_KEY`

### 23. 新闻管道重构：GDELT + fundus + trafilatura（废弃 RSS）

**文件**：`scripts/fetch_news.py`（新建）、`scripts/requirements.txt`（新建）、`.github/workflows/gdelt-fundus-fetch.yml`（新建）、`.github/workflows/scheduled-feed-fetch.yml`（废弃 cron）

**架构变更**：彻底放弃 RSS 抓取 + Jina Reader，改用三层管道：

| 组件 | 角色 | 特点 |
|------|------|------|
| **fundus** | 主力：直接爬取 171 个主流媒体 | 97.69% F1，手写解析器，2026 年仍在维护，MIT |
| **GDELT** | 补充：免费新闻索引，100+ 语言 | 无需注册，每 15 分钟更新，含 socialimage（OG 图） |
| **trafilatura** | 全文提取 GDELT 返回的 URL | 比 Jina Reader 更稳定，不依赖第三方服务 |

- GitHub Actions 每小时自动运行（替代原 RSS 分批次 cron）
- Supabase schema 不变，fundus 文章直接写入 `full_content_status = 'fetched'`
- `scheduled-feed-fetch.yml` cron 触发已移除（仅保留 workflow_dispatch 手动备用）

**需要配置的 GitHub Secrets**：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（service role key，不是 anon key）
