# Bill.ai — Claude Code 开发规范

> 本文件由 Claude Code 自动读取。每次新对话无需重复交代项目背景。

---

## 项目概况

| 项 | 值 |
|---|---|
| 路径 | `/Users/dzfk/Desktop/App for app/` (路径含空格，命令行必须加引号) |
| 产品 | Bill.ai — AI 时代的应用工厂平台（类微信小程序） |
| 前身 | Bill.ai 社交平台 (`/Users/dzfk/Desktop/bill.ai-main/`) |
| 关联 | Rich Game (`/Users/dzfk/Desktop/rich game/`) — 第一个插件应用 |

### 架构
```
Platform  — React/Vite/TypeScript, shadcn/ui + Tailwind CSS
Backend   — Supabase (Auth + PostgreSQL + Realtime + Storage + Edge Functions)
Storage   — Supabase (<10MB) + Cloudflare R2 (大文件, Phase 2)
Apps      — iframe 沙盒 + @billai/app-sdk (postMessage)
```

### 目录结构
```
App for app/
├── platform/              ← Bill.ai 平台前端 (React + shadcn/ui)
│   ├── src/
│   │   ├── components/    ← UI 组件 (58 shadcn + 自定义)
│   │   ├── hooks/         ← 自定义 React Hooks (50+)
│   │   ├── pages/         ← 页面路由
│   │   ├── contexts/      ← React Context Providers
│   │   ├── lib/           ← 工具函数
│   │   ├── integrations/  ← Supabase 客户端 + 类型
│   │   ├── services/      ← 服务层
│   │   ├── types/         ← TypeScript 类型定义
│   │   ├── index.css      ← 全局样式 + CSS 变量 (Design Token)
│   │   ├── App.tsx        ← 根组件 + 路由
│   │   └── main.tsx       ← 入口
│   ├── supabase/          ← Supabase 配置 + 迁移 + Edge Functions
│   ├── public/            ← 静态资源
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── components.json    ← shadcn/ui 配置
├── packages/
│   ├── sdk/               ← @billai/app-sdk (应用 SDK)
│   └── ui/                ← @billai/ui (应用组件库)
├── docs/
│   ├── PLATFORM_ARCHITECTURE.md  ← 架构索引 (v2.4, 22 篇)
│   └── architecture/             ← 22 篇详细架构文档
├── CLAUDE.md              ← 本文件
└── HANDOFF.md             ← 变更日志
```

### 启动命令
```bash
# Platform 前端
cd "/Users/dzfk/Desktop/App for app/platform" && npm run dev

# Supabase 本地 (如果需要)
cd "/Users/dzfk/Desktop/App for app/platform" && npx supabase start
```

---

## 开发工作流

### 开始新功能前，优先复用而非从零开发：

1. **搜索现有方案** — 先上 GitHub、npm、开源社区搜索是否有成熟的库、工具或代码片段可以直接使用
2. **评估第三方服务** — 考虑是否有 SaaS / API / 第三方服务能直接解决问题（如支付、邮件、搜索等）
3. **改造优于重写** — 如果找到 80% 匹配的开源方案，优先 fork/改造，而非从头实现
4. **造轮子是最后选项** — 只有在确认没有合适的现成方案、或现有方案无法满足核心需求时，才从零编写

> 原则：**Buy > Borrow > Build**。节省开发时间，站在巨人肩膀上。

### 完成一个功能后，必须执行以下步骤：

1. **类型检查** — `cd "/Users/dzfk/Desktop/App for app/platform" && npx tsc --noEmit`（必须通过）
2. **Lint** — `cd "/Users/dzfk/Desktop/App for app/platform" && npx eslint src/`
3. **构建验证** — `cd "/Users/dzfk/Desktop/App for app/platform" && npm run build`
4. **自测** — 确认功能正常工作（能跑 preview 就跑 preview）
5. **更新 HANDOFF.md** — 记录变更摘要
6. **更新 memory 文件**（如涉及架构级变更）
7. **更新服务清单**（如引入新依赖） → `.claude/commands/services.md`
8. **更新可配置项注册表** — 识别本次功能中的可变参数（冷却时间、阈值、开关等），记录到 `docs/ADMIN_SETTINGS_REGISTRY.md`
9. **不要自动 commit/push** — 除非用户明确要求

### HANDOFF.md 格式约定

```markdown
### N. 功能名称（简短）

**文件**：`path/to/file.ts`（新建）、`path/to/other.ts`（修改）

- 变更点 1
- 变更点 2
```

---

## 代码规范

### 通用

- TypeScript（平台前端）
- 变量/函数用 camelCase，类型/接口用 PascalCase
- 所有路径含空格，shell 命令必须引号包裹
- 使用 `@/` 路径别名（`@/components`, `@/hooks`, `@/lib`）

### Platform 前端

- **框架**: React 18 + Vite + TypeScript
- **UI**: shadcn/ui (Radix UI) + Tailwind CSS
- **状态**: React Query (服务端状态) + Context (客户端状态)
- **表单**: React Hook Form + Zod 校验
- **路由**: React Router v6
- **主题**: next-themes (light/dark), CSS 变量系统
- **通知**: Sonner (`toast`)，禁止 `alert()`
- **图标**: Lucide React
- **样式规则**:
  - 颜色只用 CSS 变量（`--primary`, `--background` 等），不硬编码
  - 使用 Tailwind utility classes，不写内联 style（除非动态计算）
  - 支持 light/dark 双模式
- **组件规则**:
  - 优先使用 shadcn/ui 组件（`@/components/ui/`）
  - 新增 shadcn 组件: `npx shadcn-ui@latest add <component>`
  - 业务组件放 `@/components/`，不放 `@/components/ui/`

### Supabase

- **Auth**: 邮箱/Google/Apple 登录（Supabase Auth）
- **DB**: PostgreSQL，所有表启用 RLS
- **Realtime**: 聊天/通知用 Supabase Realtime Channel
- **迁移**: `supabase/migrations/` 目录，时间戳命名
- **Edge Functions**: `supabase/functions/` 目录（Deno）
- **类型**: `src/integrations/supabase/types.ts`（自动生成，不手动修改）

### 国际化 (i18n)

- 使用 `react-i18next`（待接入）
- 翻译文件: `public/locales/{zh,en}/translation.json`
- key 风格: `page.section.label`
- 新增翻译必须同时更新中英两个 JSON

---

## 架构文档

完整架构设计见 `docs/PLATFORM_ARCHITECTURE.md`（22 篇文档索引）。

关键文档快速链接：
- 平台核心: `docs/architecture/01-platform-core.md`
- SDK 沙盒: `docs/architecture/02-app-runtime.md`
- 后端架构: `docs/architecture/03-backend.md`
- 技术决策 + DB Schema: `docs/architecture/12-tech-decisions.md`
- UI 设计系统: `docs/architecture/13-ui-design-system.md`
- 安全: `docs/architecture/18-security-ops.md`
- 测试策略: `docs/architecture/20-testing-strategy.md`
- CI/CD: `docs/architecture/21-cicd-pipeline.md`

---

## 关键技术约束

### 1. 三层 UI 控制模型

```
第一层: 平台 Shell（顶栏、侧栏、系统弹窗）→ 平台控制，不可改
第二层: 平台功能页（商店、频道、钱包等）→ 平台控制，统一风格
第三层: 应用 iframe（Rich Game 等）→ 应用自由，可选跟随
```

### 2. 五方分润

```
每笔应用交易: 平台 5% + 开发者 70% + 频道主 15% + 推广者 5% + 应用 5%
（没有频道主/推广者时，其份额归开发者）
```

### 3. 应用沙盒

- 应用运行在 iframe 中，通过 postMessage 与平台通信
- 支付/权限弹窗必须由平台 Shell 渲染（不允许应用伪造）
- `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`

### 4. Design Token

- 所有颜色通过 `index.css` CSS 变量定义
- 换色/换字体/换圆角 = 只改 CSS 变量，不改组件
- 应用通过 SDK `billai.ui.getTheme()` 获取平台 Design Token

### 5. VITE_* 环境变量

- `VITE_*` 前缀变量在构建时注入（修改后必须重新构建）
- 非 `VITE_*` 变量是运行时

---

## 文件索引

| 文件 | 说明 |
|------|------|
| `CLAUDE.md` (本文件) | 开发规范 |
| `HANDOFF.md` | 功能变更日志 |
| `docs/PLATFORM_ARCHITECTURE.md` | 架构索引（22 篇文档） |
| `docs/architecture/*.md` | 详细架构文档 |
| `.claude/commands/context.md` | `/context` — 加载项目上下文 |
| `.claude/commands/services.md` | `/services` — 服务依赖清单 |
| `.claude/commands/finish.md` | `/finish` — 完成功能收尾 |
| `.claude/commands/dev-check.md` | `/dev-check` — 开发检查 |
| `.claude/commands/status.md` | `/status` — 项目状态 |

---

## 禁止事项

- **不要自动 commit/push** — 除非用户明确要求
- **不要修改 .env** — 环境变量由用户手动管理
- **不要删除数据** — 任何 Supabase 表的 TRUNCATE/DROP/DELETE 需用户确认
- **不要在代码中硬编码密钥、密码**
- **不要跳过 HANDOFF.md 更新** — 完成功能后必须记录
- **不要手动修改 `integrations/supabase/types.ts`** — 这是自动生成的
- **不要引入新的 CSS 框架** — 统一用 Tailwind + shadcn/ui
- **不要在组件中硬编码颜色** — 使用 CSS 变量
