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
