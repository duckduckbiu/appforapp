# 11 — 阶段规划与目录结构

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 11.1 项目目录结构

```
billai/                              ← 新的顶级项目目录
├── platform/                        ← Bill.ai 平台（从 bill.ai-main 迁入）
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/              ← MainLayout, TopHeader, Sidebar, ContentSandbox
│   │   │   ├── app-runtime/         ← 【新】应用沙盒运行时
│   │   │   │   ├── AppIframe.tsx    ← iframe 容器 + postMessage 桥
│   │   │   │   ├── AppLoader.tsx    ← 应用加载/卸载管理
│   │   │   │   └── SDKHost.ts       ← 平台侧 SDK 消息处理器
│   │   │   ├── store/               ← 【新】应用商店 UI
│   │   │   ├── messaging/           ← 聊天组件（已有）
│   │   │   ├── posts/               ← Feed 组件（已有）
│   │   │   └── ui/                  ← shadcn/ui 组件（已有）
│   │   ├── contexts/                ← React Contexts（已有）
│   │   ├── hooks/                   ← 自定义 Hooks（已有）
│   │   ├── pages/                   ← 平台页面（已有 + 新增应用商店页）
│   │   ├── services/                ← 服务层
│   │   └── lib/                     ← 工具库
│   ├── supabase/                    ← Supabase 配置和迁移
│   ├── package.json
│   └── vite.config.ts
│
├── sdk/                             ← 【新】App SDK npm 包
│   ├── src/
│   │   ├── index.ts                 ← SDK 入口
│   │   ├── modules/                 ← 各功能模块
│   │   │   ├── user.ts
│   │   │   ├── wallet.ts
│   │   │   ├── ui.ts
│   │   │   ├── events.ts
│   │   │   ├── subscription.ts
│   │   │   ├── storage.ts
│   │   │   ├── social.ts
│   │   │   ├── chat.ts
│   │   │   ├── notification.ts
│   │   │   └── permission.ts
│   │   ├── transport/
│   │   │   └── postmessage.ts       ← postMessage 通信层
│   │   └── types.ts                 ← 类型定义
│   ├── package.json                 ← @billai/app-sdk
│   └── tsconfig.json
│
├── apps/                            ← 应用目录
│   ├── rich-game/                   ← Rich Game（从现有项目迁入）
│   │   ├── frontend/                ← 游戏前端（改造后）
│   │   ├── backend/                 ← 游戏后端（基本不动）
│   │   ├── admin/                   ← 管理后台（保留）
│   │   └── billai.manifest.json     ← 应用清单
│   └── app-template/                ← 【新】应用模板（AI 生成用）
│       ├── src/
│       └── billai.manifest.json
│
├── docs/                            ← 项目文档
│   ├── PLATFORM_ARCHITECTURE.md     ← 架构索引
│   └── architecture/                ← 架构详细文档（本目录）
│
└── CLAUDE.md                        ← 新的开发规范
```

## 11.2 从 Bill.ai 旧代码中保留/删除的模块

### 保留（迁入新平台）

| 模块 | 文件/目录 | 说明 |
|------|----------|------|
| 布局系统 | `components/layout/*` | 三段式布局，核心 UI |
| 聊天系统 | `components/messaging/*`, `hooks/useChat*` | 私聊/群聊 |
| Feed 系统 | `components/posts/*`, `hooks/usePost*` | 发帖/评论/点赞 |
| 权限系统 | `contexts/AppPermissionsContext.tsx` | 5 种权限模式 |
| 通知系统 | `contexts/NotificationContext.tsx` | 通知管理 |
| 灵动岛 SDK | `lib/DynamicIslandSDK.ts` | 灵动岛通知 |
| UI 组件 | `components/ui/*` | 60+ shadcn/ui 组件 |
| 认证 | Supabase Auth 配置 | 邮箱/Google 登录 |
| 用户资料 | `pages/ProfilePage.tsx`, `UserSettings.tsx` | 个人中心 |
| 好友系统 | `pages/Friends.tsx`, `hooks/useFollow.ts` | 社交关系 |
| 消息队列 | `components/MessageQueueProcessor.tsx` | 离线消息 |
| 图片工具 | `lib/imageCompression.ts`, `hooks/useImageUpload.ts` | 图片压缩上传 |

### 删除（不再需要）

| 模块 | 文件/目录 | 原因 |
|------|----------|------|
| AI 分身管理 | `pages/Avatars.tsx`, `AvatarEdit.tsx`, `AvatarManagement.tsx` | 方向改变 |
| 分身创建向导 | `components/AvatarCreationWizard.tsx` | 同上 |
| 身份切换 | `contexts/IdentityContext.tsx` | 不再需要真人/AI 分身切换 |
| AI 权限管理 | `pages/AIPermissionManagement.tsx` | 不再有 AI 分身概念 |
| 远程控制 | `pages/RemoteControl.tsx` | AI 分身的远程控制面板 |
| 语音播放 | `contexts/VoicePlayerContext.tsx` | AI 语音功能 |
| AI Agent | `services/AIAgentClient.ts` | 旧架构的 AI 代理 |

### 新增（平台化需要）

| 模块 | 说明 |
|------|------|
| 应用运行时 | iframe 管理、SDK Host、应用生命周期 |
| App SDK 包 | `@billai/app-sdk` npm 包 |
| 应用商店 | 应用列表、搜索、安装、卸载、评价 |
| App Token 系统 | 平台为应用签发的短期 Token |
| 应用审核系统 | manifest 验证、内容审核、年龄分级 |
| 举报与投诉系统 | 举报按钮、审核队列、处理流程 |
| 封禁与处罚系统 | 多级封禁、处罚阶梯 |
| 内容审核管道 | 自动过滤 + 人工审核 |
| 地区限制引擎 | IP 地理定位、应用可用性过滤 |
| AgeGate 组件 | 年龄确认门控 |
| 频道系统 | 频道创建、管理、成员、应用安装 |
| 分润引擎 | 五方分账（平台/开发者/频道主/推广者/应用） |
| 订阅引擎 | 统一订阅管理（平台/应用/频道/开发者） |
| 推广系统 | 推广链接、归因追踪、CPA/CPS |
| 存储服务 | Cloudflare R2 对接、配额管理 |

---

## 11.3 开发阶段规划

### Phase 0：架构验证（1 周）

**目标**：验证 iframe + postMessage 通信可行性

- [ ] 创建最小 SDK 原型（user.getProfile + wallet.getBalance）
- [ ] 创建最小 Host 原型（iframe 加载 + postMessage 处理）
- [ ] 将 Rich Game 前端放入 iframe 跑通一个完整流程
- [ ] 验证 WebSocket 在 iframe 内正常工作

**交付物**：能在 Bill.ai 壳子里打开 Rich Game 并完成一局游戏

### Phase 1：平台基础搭建（2-3 周）

**目标**：Bill.ai 平台核心功能就绪

- [ ] 迁移 bill.ai-main 代码到新目录结构
- [ ] 删除 AI 分身相关模块
- [ ] 登录改为邮箱/Google/Apple（Supabase Auth），钱包变成设置项
- [ ] 实现应用运行时（AppIframe + SDKHost）
- [ ] 实现 App SDK 核心模块（user、wallet、ui、events）
- [ ] 实现应用商店基础版（列表、详情、安装、卸载）
- [ ] 实现 App Token 签发和验证
- [ ] 实现频道系统基础版（创建、加入、应用安装）
- [ ] 举报系统基础版（举报按钮 + reports 表 + 审核队列）
- [ ] 用户封禁系统（bans 表 + 平台级封禁检查中间件）
- [ ] 年龄分级 Manifest 字段验证 + AgeGate 组件
- [ ] 地区限制 Manifest 字段验证 + IP 检测基础版
- [ ] 分润引擎基础版（五方分账）
- [ ] Cloudflare R2 配置 + SDK storage 基础模块

**交付物**：能从应用商店安装 Rich Game 并正常游戏，具备基本合规骨架

### Phase 2：Rich Game 完整迁移（1-2 周）

**目标**：Rich Game 完全作为 Bill.ai 插件运行

- [ ] Rich Game 前端接入 App SDK
- [ ] 删除 Rich Game 的独立认证（AuthContext）
- [ ] 删除 Rich Game 的独立钱包页面
- [ ] Rich Game 后端改用 App Token 验证
- [ ] Rich Game Admin 面板处理（独立保留或迁入）
- [ ] 端到端测试：注册 → 安装 → 游戏 → 提现
- [ ] 推广链接基础版（生成 + 归因追踪 + CPA 奖励）
- [ ] 应用订阅基础版（SDK subscription 模块）

**交付物**：Rich Game 不再需要独立域名，完全在 Bill.ai 内运行

### Phase 3：平台功能完善（2-3 周）

**目标**：社交、聊天、Feed 完整可用 + 合规体系上线

- [ ] 聊天系统接通（SDK chat 模块）
- [ ] Feed/动态系统接通（SDK social 模块）
- [ ] 通知系统完善（灵动岛 + 推送）
- [ ] 自动内容过滤（关键词 + AI 文本检测 + 图片 NSFW 扫描）
- [ ] 审核员 Dashboard（Admin 面板新增模块）
- [ ] 完整举报流程（举报 → 审核 → 处罚 → 通知 → 申诉）
- [ ] 用户处罚阶梯（警告 → 禁言 → 应用封禁 → 平台封禁）
- [ ] ToS / 隐私政策页面
- [ ] 应用审核半自动化流程
- [ ] 法币充值（Stripe）+ KYC Level 0/1
- [ ] 频道订阅
- [ ] 推广者 Dashboard + CPS 分润
- [ ] 视频上传基础版

### Phase 4：AI 应用生成 + App Store 上架（3-4 周）

**目标**：用户通过自然语言生成应用 + 移动端上架

- [ ] 应用模板系统
- [ ] AI 生成引擎（基于模板 + LLM）
- [ ] 生成应用的自动审核
- [ ] 应用发布到商店的流程
- [ ] 开发者工具和文档
- [ ] Apple IAP 充值（iOS 版）
- [ ] Google Pay 充值（Android 版）
- [ ] KYC Level 2
- [ ] 平台订阅（Pro / Max）
- [ ] 开发者订阅
- [ ] Cloudflare Stream 视频转码
