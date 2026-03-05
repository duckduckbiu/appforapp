# 13 — UI 与设计系统

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 13.1 设计架构：三层 UI 控制模型

```
┌─ 第一层：平台 Shell（平台控制，不可改）─────────────┐
│  顶栏、侧栏、系统弹窗、支付确认、通知、AgeGate      │
│  → 用户看到的永远是统一的 Bill.ai 风格               │
│  → 安全相关弹窗（支付、权限）必须由平台渲染           │
├─ 第二层：平台功能页（平台控制，统一风格）─────────────┤
│  聊天、Feed、个人中心、设置、应用商店、频道           │
│  钱包、推广者/开发者/频道主 Dashboard                │
│  → 使用同一套 Design Token + shadcn/ui 组件          │
├─ 第三层：应用 UI（应用自由，可选跟随）───────────────┤
│  每个应用在 iframe 里自己画 UI                       │
│  → 平台通过 SDK 传递 Design Token（颜色、字体、模式） │
│  → 应用可以选择跟随平台风格，也可以完全自定义         │
│  → AI 生成的应用默认使用 @billai/ui 组件库           │
└──────────────────────────────────────────────────────┘
```

## 13.2 换肤能力：改一个文件换全套

### 单一真相源：`index.css`

Bill.ai 的所有视觉样式最终都追溯到 `index.css` 中的 CSS 变量：

```
index.css（CSS 变量定义）
  ↓ 被引用
tailwind.config.ts（Tailwind 颜色映射）
  ↓ 被引用
shadcn/ui 60 个组件（Tailwind 类名）
  ↓ 被引用
所有平台页面 + 业务组件
```

**换颜色**：改 `index.css` 里的变量值
**换字体**：改 `index.css` 里的 `--font-sans` / `--font-serif` / `--font-mono`
**换圆角**：改 `index.css` 里的 `--radius`
**换 light/dark**：`index.css` 中 `:root` 和 `.dark` 两套变量

不需要动任何组件文件。

### 现状验证

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 颜色全部走 CSS 变量？ | ✅ 99%+ | 仅 8 处硬编码（截图/图片处理，非 UI） |
| Tailwind 颜色全部引用变量？ | ✅ 100% | tailwind.config.ts 全部 `hsl(var(--xxx))` |
| shadcn/ui 组件走 Tailwind？ | ✅ 100% | 标准 shadcn/ui 实现 |
| 内联样式泄漏？ | ⚠️ 28 处 | 多数是动态计算（宽高/位置），非颜色 |

## 13.3 Design Token 规范

### 语义色（Semantic Colors）

```
┌─ 功能色 ──────────────────────────────────────────┐
│                                                    │
│  --primary          主色调（品牌色）                 │
│  --primary-foreground  主色上的文字                  │
│                                                    │
│  --secondary        次要色（辅助操作）               │
│  --secondary-foreground                            │
│                                                    │
│  --accent           强调色（高亮、选中态）            │
│  --accent-foreground                               │
│                                                    │
│  --destructive      危险色（删除、错误）             │
│  --destructive-foreground                          │
│                                                    │
│  --muted            弱化色（禁用、占位）             │
│  --muted-foreground                                │
│                                                    │
├─ 区域色 ──────────────────────────────────────────┤
│                                                    │
│  --background       页面背景                        │
│  --foreground       默认文字                        │
│                                                    │
│  --card             卡片背景                        │
│  --card-foreground  卡片文字                        │
│                                                    │
│  --popover          弹出层背景                      │
│  --popover-foreground                              │
│                                                    │
│  --header-background 顶栏背景                      │
│  --sidebar-background 侧栏背景                     │
│                                                    │
├─ 边界色 ──────────────────────────────────────────┤
│                                                    │
│  --border           分割线、边框                    │
│  --input            输入框边框                      │
│  --ring             焦点环                          │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 当前配色方案（紫色系）

| Token | Light 模式 | Dark 模式 | 用途 |
|-------|-----------|-----------|------|
| `--primary` | `258 89% 66%` (紫) | `255 91% 76%` (浅紫) | 按钮、链接、强调 |
| `--background` | `240 4% 95%` (浅灰) | `0 0% 10%` (深灰) | 页面底色 |
| `--card` | `0 0% 98%` (白) | `0 0% 12%` (暗灰) | 卡片底色 |
| `--header-background` | `240 4% 95%` | `0 0% 0%` (纯黑) | 顶栏 |
| `--sidebar` | `0 0% 98%` | `0 0% 5%` (近黑) | 侧栏 |
| `--destructive` | `0 72% 50%` (红) | `0 84% 60%` (亮红) | 删除、错误 |

### 如何换主题

```css
/* 例：从紫色系换成蓝色系 */
:root {
  --primary: 210 100% 50%;           /* 蓝色 */
  --primary-foreground: 210 100% 97%;
  --accent: 210 100% 95%;
  --accent-foreground: 210 100% 45%;
  --ring: 210 100% 50%;
}
.dark {
  --primary: 210 100% 65%;           /* 浅蓝 */
  --primary-foreground: 210 80% 15%;
  --accent: 210 80% 20%;
  --accent-foreground: 210 100% 70%;
  --ring: 210 100% 65%;
}

/* 例：换字体 */
:root {
  --font-sans: 'Inter', system-ui, sans-serif;  /* 从 Montserrat 换成 Inter */
}
```

### 字号层级

| 级别 | Tailwind 类 | 用途 | 大小 |
|------|------------|------|------|
| h1 | `text-3xl font-bold` | 页面标题 | 30px |
| h2 | `text-2xl font-semibold` | 区块标题 | 24px |
| h3 | `text-xl font-semibold` | 卡片标题 | 20px |
| h4 | `text-lg font-medium` | 小标题 | 18px |
| body | `text-base` | 正文 | 16px |
| small | `text-sm` | 辅助文字 | 14px |
| caption | `text-xs` | 标签、时间戳 | 12px |

### 间距系统

```
基于 4px 网格（Tailwind 默认 --spacing: 0.25rem）:

  间距 1  =  4px   → p-1, m-1, gap-1
  间距 2  =  8px   → p-2, m-2, gap-2
  间距 3  = 12px   → p-3, m-3, gap-3
  间距 4  = 16px   → p-4, m-4, gap-4   ← 常用卡片内边距
  间距 6  = 24px   → p-6, m-6, gap-6   ← 区块间距
  间距 8  = 32px   → p-8, m-8, gap-8   ← 页面内边距
```

### 圆角

```
--radius: 0.5rem  (8px)

  圆角 sm = 4px   → rounded-sm    （小按钮、标签）
  圆角 md = 6px   → rounded-md    （输入框）
  圆角 lg = 8px   → rounded-lg    （卡片、弹窗）
  圆角 xl = 12px  → rounded-xl    （大卡片）
  圆角 full       → rounded-full  （头像、徽章）
```

## 13.4 平台业务组件清单

> 以下是平台特有的业务组件，需要新建。
> 通用组件（Button, Card, Dialog 等）使用现有 shadcn/ui，不在此列出。

### 安全相关（第一层 Shell，必须平台渲染）

| 组件 | 用途 | 优先级 |
|------|------|--------|
| `PaymentConfirmDialog` | SDK `wallet.charge()` 触发的支付确认弹窗。显示金额、收款应用、余额。用户确认后才扣款。**不允许应用伪造。** | Phase 0 |
| `PermissionRequestDialog` | 应用请求权限时弹出。显示权限名称、原因、应用信息。用户选择允许/拒绝。 | Phase 1 |
| `AgeGateDialog` | 用户首次打开 17+ 应用时弹出。确认年龄后记录到 profiles 表。 | Phase 1 |
| `RegionBlockDialog` | 用户所在地区受限时显示。说明原因，不可绕过。 | Phase 1 |

### 应用商店相关

| 组件 | 用途 | 优先级 |
|------|------|--------|
| `AppCard` | 应用商店列表中的应用卡片。显示图标、名称、评分、安装量、年龄标签。 | Phase 1 |
| `AppDetailSheet` | 应用详情页。截图轮播、描述、权限列表、评价、安装按钮。 | Phase 1 |
| `AppCategoryNav` | 应用分类导航。游戏 / 工具 / 社交 / 教育 / ... | Phase 1 |

### 频道相关

| 组件 | 用途 | 优先级 |
|------|------|--------|
| `ChannelCard` | 频道列表卡片。封面、名称、成员数、已安装应用图标。 | Phase 1 |
| `ChannelAppInstaller` | 频道主在频道内安装/卸载应用的管理面板。 | Phase 1 |

### 角色与收入相关

| 组件 | 用途 | 优先级 |
|------|------|--------|
| `RoleBadge` | 角色徽章。🛠 开发者 / 📺 频道主 / 📢 推广者。显示在用户头像旁。 | Phase 2 |
| `EarningsSummaryCard` | 收入汇总卡片。总收入 / 今日 / 趋势迷你图。用于各 Dashboard。 | Phase 2 |
| `RevenueSplitBar` | 分润比例可视化条。显示五方分润占比，用色块区分。 | Phase 2 |

### 订阅相关

| 组件 | 用途 | 优先级 |
|------|------|--------|
| `SubscriptionCard` | 订阅套餐展示。价格、功能列表、订阅按钮。月/年切换。 | Phase 2 |
| `PaywallOverlay` | 付费墙。应用内容被遮挡，提示订阅解锁。 | Phase 2 |

### 推广相关

| 组件 | 用途 | 优先级 |
|------|------|--------|
| `PromoLinkCard` | 推广链接卡片。链接 + 复制按钮 + 点击/注册/收入数据。 | Phase 2 |
| `AttributionBadge` | 推广归因标签。显示「由 xxx 推荐」。 | Phase 3 |

### 举报与审核相关

| 组件 | 用途 | 优先级 |
|------|------|--------|
| `ReportDialog` | 举报弹窗。选择理由 + 描述 + 上传证据。统一入口。 | Phase 1 |
| `ModerationActionBar` | 审核员操作栏。通过/删除/警告/封禁 按钮组。Admin 用。 | Phase 2 |

## 13.5 传递 Design Token 给应用（SDK）

### 平台 → 应用

```typescript
// 应用通过 SDK 获取平台的 Design Token
const theme = await billai.ui.getTheme();

// 返回:
{
  mode: 'dark',                          // 当前主题模式
  colors: {
    primary: 'hsl(255, 91%, 76%)',       // 品牌色
    primaryForeground: 'hsl(261, 72%, 22%)',
    background: 'hsl(0, 0%, 10%)',       // 页面底色
    foreground: 'hsl(0, 0%, 98%)',       // 文字色
    card: 'hsl(0, 0%, 12%)',             // 卡片底色
    destructive: 'hsl(0, 84%, 60%)',     // 错误/危险色
    muted: 'hsl(0, 0%, 20%)',            // 弱化色
    border: 'hsl(0, 0%, 10%)',           // 边框色
  },
  fonts: {
    sans: 'Montserrat, system-ui, sans-serif',
    mono: 'IBM Plex Mono, monospace',
  },
  radius: '0.5rem',
}

// 监听主题切换（用户切 light/dark 时）
billai.ui.onThemeChange((newTheme) => {
  applyTheme(newTheme);
});
```

### 应用如何使用

```typescript
// 方案 A: 使用 @billai/ui 组件库（AI 生成应用默认使用）
//   → 自动读取 Design Token，无需手动处理
import { Button, Card } from '@billai/ui';

// 方案 B: 手动应用到自己的 CSS 变量
const theme = await billai.ui.getTheme();
document.documentElement.style.setProperty('--app-primary', theme.colors.primary);
document.documentElement.style.setProperty('--app-bg', theme.colors.background);

// 方案 C: 完全忽略，用自己的设计
//   → Rich Game 可能选这个方案（游戏有自己的视觉风格）
```

## 13.6 可选组件库 `@billai/ui`（Phase 2）

```
面向开发者和 AI 生成的应用:

  npm install @billai/ui

特点:
  ├── 基于 shadcn/ui 封装（平台已有的 60 个组件的子集）
  ├── 自动读取平台 Design Token（跟随 light/dark 切换）
  ├── 体积小（Tree-shakable，只打包用到的组件）
  ├── TypeScript 类型完整
  └── 零配置（import 就能用）

包含组件（~20 个常用的）:
  ├── 布局: Container, Stack, Grid
  ├── 基础: Button, Input, Textarea, Select, Checkbox, Switch
  ├── 展示: Card, Badge, Avatar, Separator, Skeleton
  ├── 反馈: Toast, Dialog, AlertDialog
  ├── 导航: Tabs, DropdownMenu
  └── 特殊: PaywallCard, SubscriptionBadge

不包含:
  └── 复杂的图表、表格、日历等（应用自行引入 recharts 等）
```

## 13.7 设计规则（给开发者的指南）

```
必须遵守（苹果审核相关）:
  ├── 应用不能遮挡平台顶栏（z-index 限制由 iframe 保证）
  ├── 支付/权限弹窗不能由应用伪造（由平台 Shell 渲染）
  ├── 年龄分级标签必须正确显示
  └── 举报按钮必须可访问

建议遵守（用户体验）:
  ├── 使用平台 Design Token 保持视觉一致
  ├── 支持 light/dark 双模式
  ├── 关键操作有 loading 状态反馈
  ├── 错误信息对用户友好（不要暴露技术细节）
  └── 移动端响应式（最小宽度 320px）

不强制:
  ├── 应用可以有完全不同的视觉风格（如游戏）
  ├── 应用可以使用任何 CSS 框架
  └── 应用可以使用任何组件库
```

## 13.8 Phase 规划

| 功能 | Phase 0 | Phase 1 | Phase 2 | Phase 3+ |
|------|---------|---------|---------|----------|
| Design Token 定义 | ✅ 已有 | ✅ 完善 | ✅ | ✅ |
| SDK `ui.getTheme()` | ✅ | ✅ | ✅ | ✅ |
| PaymentConfirmDialog | ✅ | ✅ | ✅ | ✅ |
| PermissionRequestDialog | — | ✅ | ✅ | ✅ |
| AgeGateDialog | — | ✅ | ✅ | ✅ |
| 应用商店 UI 组件 | — | ✅ | ✅ | ✅ |
| 频道 UI 组件 | — | ✅ | ✅ | ✅ |
| ReportDialog | — | ✅ | ✅ | ✅ |
| 角色/收入组件 | — | — | ✅ | ✅ |
| 订阅组件 | — | — | ✅ | ✅ |
| 推广组件 | — | — | ✅ | ✅ |
| `@billai/ui` 组件库 | — | — | ✅ | ✅ |
| 设计指南文档 | — | — | — | ✅ 上架前 |
