# 19 — 无障碍规范 (Accessibility / a11y)

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。
> 无障碍不是"加分项"，而是 Apple App Store 和 Google Play 的审核要点，也是欧美市场的法律义务（ADA、EAA 2025）。

---

## 19.1 合规目标

| 标准 | 级别 | 适用范围 | 时间 |
|------|------|---------|------|
| **WCAG 2.1** | AA（中级） | 平台 Shell + 功能页 | Phase 1 起 |
| **WCAG 2.1** | A（基础） | 第三方应用（建议，不强制） | SDK 文档引导 |
| Apple HIG Accessibility | — | iOS WebView / PWA | Phase 4 上架前 |
| Google Material Accessibility | — | Android WebView / PWA | Phase 4 上架前 |
| European Accessibility Act (EAA) | — | 欧盟用户 | 2025-06-28 起 |

### 为什么是 AA 而不是 AAA

- AA 覆盖了 95% 以上的实际场景（视觉、运动、认知障碍）
- AAA 要求极端严格（如所有文字 7:1 对比度），ROI 低
- 大厂标准（Google、Apple、Microsoft）均以 AA 为基线

---

## 19.2 四大原则 (POUR)

```
WCAG 四原则:

  ① 可感知 (Perceivable)
     → 用户能看到/听到/感知到所有内容
     → 关键: alt 文字、色彩对比度、字幕

  ② 可操作 (Operable)
     → 用户能用键盘/辅助设备完成所有操作
     → 关键: 键盘导航、焦点管理、触控热区

  ③ 可理解 (Understandable)
     → 用户能理解内容和操作结果
     → 关键: 错误提示、一致性、语言标记

  ④ 健壮 (Robust)
     → 内容能被各种辅助技术正确解析
     → 关键: 语义 HTML、ARIA、标准组件
```

---

## 19.3 色彩与视觉

### 对比度要求 (WCAG 2.1 AA)

| 元素 | 最低对比度 | 说明 |
|------|-----------|------|
| 正文文字（< 18px） | **4.5:1** | 前景色 vs 背景色 |
| 大号文字（≥ 18px bold 或 ≥ 24px） | **3:1** | 标题、按钮文字 |
| UI 组件边框、图标 | **3:1** | 按钮边框、输入框、图标 |
| 焦点指示器 | **3:1** | focus ring 与背景 |
| 占位符文字 (placeholder) | **4.5:1** | 常被忽略 — placeholder 不能太淡 |

### 颜色不能作为唯一信息载体

```
❌ 错误示范:
  - 仅用红色/绿色区分成功/失败（色盲用户无法分辨）
  - 仅用颜色区分不同状态

✅ 正确做法:
  - 颜色 + 图标: ✅ 成功 / ❌ 失败 / ⚠️ 警告
  - 颜色 + 文字: 绿色背景 + "已通过" 文字
  - 颜色 + 形状: 不同状态用不同图形（● ■ ▲）
```

### Design Token 对比度验证

```
每次修改 index.css 的颜色变量后，必须验证:

  --foreground vs --background        ≥ 4.5:1
  --primary-foreground vs --primary   ≥ 4.5:1
  --card-foreground vs --card         ≥ 4.5:1
  --muted-foreground vs --background  ≥ 4.5:1
  --destructive-foreground vs --destructive ≥ 4.5:1

工具:
  - Chrome DevTools → Rendering → Emulate vision deficiencies
  - WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
  - Figma 插件: Stark / Color Contrast Checker
```

---

## 19.4 键盘导航

### 基本要求

```
所有功能必须仅用键盘完成（不依赖鼠标）:

  Tab         → 前进焦点
  Shift+Tab   → 后退焦点
  Enter/Space → 激活按钮/链接
  Escape      → 关闭弹窗/下拉
  Arrow Keys  → 菜单/列表内导航

焦点必须可见:
  → 默认使用 --ring 变量画 focus ring
  → 禁止 outline: none 不加替代样式
  → 焦点顺序 = DOM 顺序（不要用 CSS 改变视觉顺序后忘记调 tabIndex）
```

### 焦点管理规则

| 场景 | 行为 |
|------|------|
| 打开 Dialog/Modal | 焦点移到 Dialog 内第一个可交互元素 |
| 关闭 Dialog/Modal | 焦点回到触发按钮 |
| 打开下拉菜单 | 焦点移到第一个菜单项 |
| Tab 到 Dialog 末尾 | 焦点循环回 Dialog 开头（焦点陷阱） |
| 页面路由切换 | 焦点移到新页面主内容区域 |
| Toast 通知出现 | 不抢焦点，用 `aria-live` 朗读 |
| 删除列表项 | 焦点移到上一项或下一项 |

### 焦点陷阱 (Focus Trap)

```typescript
// 所有模态弹窗必须实现焦点陷阱
// shadcn/ui 的 Dialog 组件已内置 — 使用它即可

// 如果自定义弹窗，必须:
//   1. 打开时: document.body aria-hidden="true" + 焦点移入
//   2. Tab 循环: 不让焦点离开弹窗
//   3. 关闭时: 移除 aria-hidden + 焦点回到触发元素
//   4. Escape 关闭
```

### 跳过导航链接 (Skip Link)

```html
<!-- 页面顶部（视觉隐藏，Tab 可达） -->
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:p-2 focus:bg-primary focus:text-primary-foreground focus:rounded">
  跳到主要内容
</a>

<!-- 主内容区 -->
<main id="main-content" tabindex="-1">
  ...
</main>
```

---

## 19.5 语义化 HTML & ARIA

### 优先使用原生语义元素

```
优先级: 原生 HTML > ARIA 属性 > 自定义组件

✅ <button>     而不是 <div onClick>
✅ <a href>     而不是 <span onClick>
✅ <nav>        而不是 <div class="nav">
✅ <main>       而不是 <div class="main">
✅ <header>     而不是 <div class="header">
✅ <dialog>     而不是 <div class="modal">
✅ <input type="checkbox"> 而不是 <div role="checkbox">

原因: 原生元素自带键盘行为和屏幕阅读器支持，不需要额外 ARIA
```

### 必须使用 ARIA 的场景

| 场景 | ARIA 属性 | 示例 |
|------|----------|------|
| 图标按钮（无文字） | `aria-label` | `<button aria-label="关闭"><XIcon /></button>` |
| 加载状态 | `aria-busy="true"` | 数据加载中的容器 |
| 实时更新区域 | `aria-live="polite"` | Toast 通知容器、在线人数 |
| 展开/折叠 | `aria-expanded` | 下拉菜单、手风琴 |
| 当前选中 | `aria-current="page"` | 导航栏当前页面 |
| 必填字段 | `aria-required="true"` | 表单必填项（配合原生 `required`） |
| 错误提示 | `aria-describedby` + `aria-invalid` | 表单验证错误 |
| 进度 | `aria-valuenow/min/max` | 进度条、加载环 |
| 标签页 | `role="tablist/tab/tabpanel"` | 选项卡组件 |

### 表单无障碍

```html
<!-- ✅ 正确: label 关联 input -->
<label htmlFor="username">用户名</label>
<input id="username" type="text" aria-required="true" />

<!-- ✅ 正确: 错误提示关联 -->
<input id="email" type="email" aria-invalid="true" aria-describedby="email-error" />
<span id="email-error" role="alert">请输入有效的邮箱地址</span>

<!-- ❌ 错误: 没有 label -->
<input type="text" placeholder="用户名" />

<!-- ❌ 错误: placeholder 不能替代 label -->
<!-- 屏幕阅读器用户输入后 placeholder 消失，不知道这个字段是什么 -->
```

---

## 19.6 图片与媒体

### 图片 Alt 文字

| 图片类型 | Alt 处理 | 示例 |
|---------|---------|------|
| 内容图片 | 描述图片内容 | `alt="应用商店截图：主界面展示投票功能"` |
| 装饰图片 | 空 alt | `alt=""` 或 `role="presentation"` |
| 图标（有文字） | 空 alt | `alt=""`（文字已说明） |
| 图标（无文字） | 描述功能 | `alt="设置"` 或 `aria-label="设置"` |
| 头像 | 用户名 | `alt="用户 Alice 的头像"` |
| SVG 图标 | `aria-hidden` | `<svg aria-hidden="true">` + 旁边加文字说明 |

### 视频 & 音频

```
Phase 4 上架要求:
  - 视频必须有字幕（至少自动生成）
  - 音频内容必须有文字替代
  - 自动播放必须静音（autoplay muted）
  - 动画可以通过 prefers-reduced-motion 关闭
```

---

## 19.7 动画与运动

### 尊重用户偏好

```css
/* 用户开启"减少动态效果"时，禁用非必要动画 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 动画规则

```
必须遵守:
  - 不要使用快速闪烁（> 3次/秒）— 可能触发光敏性癫痫
  - 大面积颜色变化的过渡 ≥ 300ms
  - 页面切换动画可被 prefers-reduced-motion 关闭
  - 自动轮播必须有暂停按钮

建议遵守:
  - 微交互动画 ≤ 300ms（按钮 hover、状态切换）
  - 页面切换动画 ≤ 500ms
  - 加载动画使用旋转/脉冲而非闪烁
```

---

## 19.8 响应式与缩放

```
WCAG 1.4.4 — 文字缩放:
  - 页面在 200% 缩放下必须可用（不截断、不重叠）
  - 不要用 px 固定字号（用 rem）
  - 不要 user-scalable=no（禁止用户缩放）

WCAG 1.4.10 — 回流 (Reflow):
  - 320px 宽度下无水平滚动条
  - 内容在 400% 缩放下可滚动阅读

viewport 正确写法:
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ❌ 不要加 maximum-scale=1 或 user-scalable=no
```

---

## 19.9 三层架构中的责任划分

```
┌─ 第一层: 平台 Shell ───────────────────────────────┐
│  ✅ 平台负责 — 必须完全符合 WCAG AA                  │
│  - 顶栏导航: 键盘可达 + aria-current                 │
│  - 侧栏菜单: 键盘导航 + 展开/折叠 ARIA              │
│  - PaymentConfirmDialog: 焦点陷阱 + 朗读金额         │
│  - AgeGateDialog: 焦点管理 + 明确的操作说明          │
│  - 通知弹窗: aria-live="polite"                      │
├─ 第二层: 平台功能页 ──────────────────────────────────┤
│  ✅ 平台负责 — 必须符合 WCAG AA                      │
│  - 表单: label 关联 + 错误提示 + 必填标记             │
│  - 列表/卡片: 语义 HTML + 键盘选择                   │
│  - 数据表格: <table> + <th scope> + <caption>        │
│  - 搜索: 结果动态更新 aria-live                       │
├─ 第三层: 应用 iframe ─────────────────────────────────┤
│  ⚠️ 应用开发者负责 — 平台提供引导                     │
│  - SDK 文档中写明 a11y 最佳实践                       │
│  - @billai/ui 组件库内置 a11y（shadcn/ui 基础）       │
│  - 应用审核时检查基本 a11y（Phase 4）:                │
│    · 页面有 <title>                                   │
│    · 图片有 alt                                       │
│    · 按钮/链接可键盘触达                              │
│    · 不使用 user-scalable=no                          │
└───────────────────────────────────────────────────────┘
```

---

## 19.10 测试 & 审计

### 自动化检测

| 工具 | 用途 | 阶段 |
|------|------|------|
| **axe-core** (CI 集成) | 自动扫描 DOM，报告 WCAG 违规 | Phase 1 |
| **eslint-plugin-jsx-a11y** | 编码时提示 a11y 问题 | Phase 1 |
| Chrome DevTools Lighthouse | 手动审计，生成报告 | 开发中随时 |
| Chrome → Rendering → 视觉缺陷模拟 | 模拟色盲、弱视 | 开发中随时 |

### 手动检测清单

```
每个新页面/组件上线前，至少过一遍:

□ 纯键盘操作: Tab 走完所有可交互元素，无陷阱、无跳过
□ 焦点可见: 每个聚焦元素有明显的 focus ring
□ 屏幕阅读器: macOS VoiceOver (Cmd+F5) 走一遍核心流程
□ 对比度: 所有文字/UI 元素通过对比度检测
□ 缩放 200%: 页面不截断、不重叠
□ 色盲模拟: Chrome 模拟 protanopia/deuteranopia 下信息不丢失
□ 语言标记: <html lang="zh"> 正确设置
```

### 审计节奏

```
Phase 1-3: 每次大功能上线前手动审计（Lighthouse ≥ 80 分）
Phase 4:   上架前专项审计（Lighthouse ≥ 90 分 + VoiceOver 全流程测试）
Phase 4+:  每季度一次 a11y 审计（或每个大版本）
```

---

## 19.11 Phase 规划

| 功能 | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|---------|
| 语义 HTML + ARIA 基础 | — | ✅ | ✅ | ✅ | ✅ |
| 键盘导航（Shell + 功能页） | — | ✅ | ✅ | ✅ | ✅ |
| 色彩对比度达标 | — | ✅ | ✅ | ✅ | ✅ |
| eslint-plugin-jsx-a11y | — | ✅ | ✅ | ✅ | ✅ |
| Skip Link | — | ✅ | ✅ | ✅ | ✅ |
| prefers-reduced-motion | — | — | ✅ | ✅ | ✅ |
| 焦点管理（Dialog/路由） | — | — | ✅ | ✅ | ✅ |
| 表单 a11y 完善 | — | — | ✅ | ✅ | ✅ |
| axe-core CI 集成 | — | — | — | ✅ | ✅ |
| VoiceOver 全流程测试 | — | — | — | — | ✅ |
| 应用审核 a11y 检查项 | — | — | — | — | ✅ |
| Lighthouse a11y ≥ 90 | — | — | — | — | ✅ |
