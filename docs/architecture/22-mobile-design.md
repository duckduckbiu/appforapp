# 22 — 移动端设计规范

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。
> Bill.ai 是 Web 应用（非原生 App），但用户主要在手机上使用。移动端体验 = 用户留存。

---

## 22.1 平台形态与适用范围

```
Bill.ai 的移动端形态:

  Phase 1-3: 移动端浏览器（Safari / Chrome）
  Phase 4:   WebView 容器（iOS / Android App 壳）
  Phase 4+:  PWA（可选，渐进增强）

本规范覆盖:
  ✅ 响应式 Web（全阶段适用）
  ✅ WebView 注意事项（Phase 4 适用）
  ❌ 原生 UI 组件（不在范围内 — 我们不写原生代码）
```

---

## 22.2 断点系统

### 标准断点

| 断点名 | 宽度 | 对应设备 | Tailwind 前缀 |
|--------|------|---------|---------------|
| **xs** | < 375px | 旧款小手机（SE 1代） | 默认（无前缀） |
| **sm** | ≥ 375px | iPhone 12/13/14/15, 大部分 Android | `sm:` |
| **md** | ≥ 768px | iPad Mini, 小平板 | `md:` |
| **lg** | ≥ 1024px | iPad Pro, 大平板, 小笔记本 | `lg:` |
| **xl** | ≥ 1280px | 笔记本, 桌面显示器 | `xl:` |
| **2xl** | ≥ 1536px | 大显示器 | `2xl:` |

### 设计基准

```
移动优先 (Mobile First):
  → 默认样式 = 手机样式
  → 用 sm:/md:/lg: 向上覆盖
  → 不要 max-width 媒体查询

核心设计宽度:
  手机: 375px（iPhone 标准宽度）
  平板: 768px
  桌面: 1280px

最小支持宽度: 320px（不能出现水平滚动条）
```

### 布局策略

```
手机（< 768px）:
  ├── 单列布局
  ├── 底部导航栏（Tab Bar）
  ├── 侧栏隐藏（汉堡菜单展开）
  ├── 卡片全宽
  └── 弹窗 = 全屏 sheet（从底部滑出）

平板（768px - 1024px）:
  ├── 双列布局（侧栏 + 主内容）
  ├── 侧栏可折叠
  ├── 卡片网格 2 列
  └── 弹窗 = 居中 Dialog

桌面（> 1024px）:
  ├── 三列布局（侧栏 + 主内容 + 辅助面板）
  ├── 侧栏常驻
  ├── 卡片网格 3-4 列
  └── 弹窗 = 居中 Dialog
```

---

## 22.3 触控交互

### 触控热区

```
Apple HIG + Material Design 共识:

  最小触控目标: 44 × 44 pt（CSS px）
  推荐触控目标: 48 × 48 px

  ✅ 按钮高度 ≥ 44px
  ✅ 列表项高度 ≥ 48px
  ✅ 图标按钮: 图标 24px + padding 至少 12px 四周 = 48px 热区
  ✅ 相邻可点击元素间距 ≥ 8px

  ❌ 不要把链接/按钮挤在一起（误触）
  ❌ 不要用 < 32px 的触控目标
```

### 触控热区示例

```css
/* ✅ 正确: 小图标但大热区 */
.icon-button {
  width: 24px;
  height: 24px;
  padding: 12px;        /* 实际触控区 = 48x48 */
  /* 或用 min-width/min-height */
}

/* ❌ 错误: 图标即热区 */
.icon-button {
  width: 24px;
  height: 24px;
  padding: 0;           /* 触控区只有 24x24，太小 */
}
```

### 手势支持

| 手势 | 用途 | 实现方式 | 阶段 |
|------|------|---------|------|
| **点击 (Tap)** | 所有操作 | onClick | Phase 0 |
| **长按 (Long Press)** | 上下文菜单、复制 | onContextMenu / 自定义 | Phase 2 |
| **左滑 (Swipe Left)** | 列表项快捷操作（删除/归档） | 自定义或库 | Phase 3 |
| **下拉刷新 (Pull to Refresh)** | 刷新列表 | 自定义组件 | Phase 2 |
| **双指缩放 (Pinch Zoom)** | 图片查看 | 浏览器原生 | 不限制 |

### 触控反馈

```
每次触控必须有视觉反馈:

  按钮: :active 状态（背景变暗或缩放）
  列表项: :active 高亮
  链接: :active 变色

  响应时间:
    视觉反馈 < 100ms（立即）
    操作结果 < 300ms（理想）
    如果 > 300ms → 显示 loading 状态

CSS 建议:
  -webkit-tap-highlight-color: transparent;   /* 去掉默认蓝色高亮 */
  touch-action: manipulation;                  /* 禁止双击缩放延迟 */
```

---

## 22.4 Safe Area 适配

### 为什么需要

```
现代手机的"异形屏":

  iPhone: 刘海（顶部）+ Home 指示条（底部）
  Android: 打孔摄像头（顶部）+ 手势导航条（底部）

如果不适配:
  → 内容被刘海遮挡
  → 底部按钮被 Home 指示条覆盖
  → 用户无法操作
```

### viewport-fit

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### CSS Safe Area

```css
/* 顶部固定栏 */
.header {
  padding-top: env(safe-area-inset-top);
}

/* 底部固定栏（Tab Bar） */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}

/* 全屏页面 */
.full-page {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Tailwind 快捷方式（需要在 tailwind.config.ts 中扩展）:
   pb-safe → padding-bottom: env(safe-area-inset-bottom)
   pt-safe → padding-top: env(safe-area-inset-top)
*/
```

### 具体场景

| 元素 | Safe Area 处理 |
|------|---------------|
| 顶部导航栏 | `padding-top: env(safe-area-inset-top)` |
| 底部 Tab Bar | `padding-bottom: env(safe-area-inset-bottom)` |
| 全屏弹窗 (Sheet) | 顶部 + 底部都加 safe area |
| 横屏游戏 | 左右也要加 `safe-area-inset-left/right` |
| iframe 内的应用 | 平台 Shell 已处理，应用不需要 |

---

## 22.5 移动端导航

### 导航模式

```
手机端（< 768px）:

  ┌─────────────────────────────────────┐
  │  ← 标题                     ⋮ ☰    │  ← 顶部栏（简洁，只有标题+操作）
  ├─────────────────────────────────────┤
  │                                     │
  │           主内容区域                 │
  │                                     │
  │                                     │
  ├─────────────────────────────────────┤
  │  🏠    🔍    🎮    👤    ⚙️      │  ← 底部 Tab Bar（5 个以内）
  │  首页  发现  游戏  我的  更多      │
  └──────────────────────────┬──────────┘
                             │
                    padding-bottom: safe-area

桌面端（≥ 1024px）:

  ┌──────┬──────────────────────────────┐
  │      │                              │
  │ 侧栏  │         主内容区域           │
  │ 导航  │                              │
  │      │                              │
  └──────┴──────────────────────────────┘
```

### 底部 Tab Bar 规则

```
数量: 3-5 个（超过 5 个用"更多"折叠）
图标: 24px，线性图标（选中态可填充）
文字: 12px，图标下方
高度: 56px + safe-area-inset-bottom
当前页: 图标+文字高亮（使用 --primary 色）

不要:
  ❌ 在 Tab Bar 中放表单操作（如"发布"）
  ❌ Tab 超过 5 个
  ❌ Tab 文字超过 4 个字
```

### 页面过渡

```
移动端页面切换动画:

  前进（push）: 新页面从右侧滑入（300ms ease-out）
  后退（pop）:  当前页面向右滑出（250ms ease-in）
  Tab 切换: 无动画（瞬时切换）
  弹窗: 从底部滑入（300ms ease-out）

尊重 prefers-reduced-motion:
  @media (prefers-reduced-motion: reduce) → 关闭所有过渡动画
```

---

## 22.6 移动端输入

### 虚拟键盘处理

```
键盘弹出时的问题:
  → 页面被推上去（viewport 变小）
  → 底部固定元素被键盘遮挡
  → 输入框被键盘遮挡

解决方案:

  1. 输入框获取焦点时，滚动到可见区域:
     input.scrollIntoView({ behavior: 'smooth', block: 'center' });

  2. 底部固定栏在键盘弹出时隐藏:
     用 visualViewport API 检测键盘状态

  3. 全屏表单页面用固定布局:
     position: fixed; 整体布局，避免滚动跳动

  4. 不要在键盘弹出时弹 toast:
     toast 可能被键盘遮挡
```

### 输入类型优化

```html
<!-- 根据输入内容选择正确的键盘类型 -->

<!-- 邮箱 → 显示 @ 和 . 的键盘 -->
<input type="email" inputMode="email" />

<!-- 数字金额 → 数字键盘 -->
<input type="text" inputMode="decimal" />

<!-- 搜索 → 键盘显示"搜索"按钮 -->
<input type="search" enterKeyHint="search" />

<!-- 发送消息 → 键盘显示"发送"按钮 -->
<input type="text" enterKeyHint="send" />

<!-- 验证码 → 数字键盘，自动填充 -->
<input type="text" inputMode="numeric" autoComplete="one-time-code" />

<!-- 钱包地址 → 禁止自动修正 -->
<input type="text" autoCorrect="off" autoCapitalize="off" spellCheck="false" />
```

### 表单设计

```
移动端表单规则:

  ✅ 一列布局（不要左右并排）
  ✅ label 在 input 上方（不在左边）
  ✅ 输入框全宽
  ✅ 提交按钮全宽，固定在底部
  ✅ 实时校验（失焦时，不是提交时）
  ✅ 错误提示紧跟在输入框下方

  ❌ 不要用 select 下拉（在移动端体验差）→ 用 bottom sheet 选择器
  ❌ 不要用日期 input → 用移动端友好的日期选择组件
  ❌ 不要用 hover tooltip → 移动端没有 hover
```

---

## 22.7 移动端性能

### 关键指标 (Core Web Vitals)

| 指标 | 目标 | 说明 |
|------|------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | 最大内容元素渲染时间 |
| **INP** (Interaction to Next Paint) | < 200ms | 交互响应时间 |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 布局偏移分数 |
| **FCP** (First Contentful Paint) | < 1.8s | 首次内容渲染 |
| **TTFB** (Time to First Byte) | < 800ms | 服务器响应时间 |

### 性能优化清单

```
图片:
  ✅ 使用 WebP/AVIF 格式（比 PNG 小 50-80%）
  ✅ 响应式图片（srcset + sizes）
  ✅ 懒加载非首屏图片（loading="lazy"）
  ✅ 头像/图标使用固定尺寸（防止 CLS）

JavaScript:
  ✅ 路由级代码分割（React.lazy + Suspense）
  ✅ 第三方库按需引入（不全量 import）
  ✅ 长列表虚拟化（react-window 或 @tanstack/virtual）

CSS:
  ✅ 首屏关键 CSS 内联
  ✅ 非首屏 CSS 异步加载
  ✅ 避免大量 box-shadow（移动端渲染开销大）

网络:
  ✅ API 响应开启 gzip/brotli
  ✅ 静态资源 CDN（Railway 自动）
  ✅ 预连接关键域名: <link rel="preconnect" href="https://..." />
```

### 弱网优化

```
移动端网络不稳定是常态（地铁、电梯、偏远地区）:

  ✅ 所有 API 调用有超时: fetch with AbortController（10s 超时）
  ✅ 失败时显示友好提示（不是空白页）
  ✅ 关键数据本地缓存（React Query staleTime）
  ✅ 重连机制（WebSocket 断线自动重连 + 指数退避）
  ✅ 乐观更新（投票后立即显示结果，后台确认）

  ❌ 不要假设网络永远可用
  ❌ 不要在弱网下自动加载大资源（视频、高清图）
```

---

## 22.8 移动端特有 UI 模式

### Bottom Sheet（底部弹出面板）

```
移动端标准交互模式（代替桌面端的 Dialog/Dropdown）:

用途:
  - 筛选/排序选项
  - 操作菜单（分享/编辑/删除）
  - 简单表单（评论、评分）
  - 选择器（币种、链、时间范围）

行为:
  - 从底部滑入，带遮罩
  - 可以下拉关闭（拖拽手柄）
  - 最大高度 = 90vh
  - 内容超出时可滚动
  - 圆角顶部 (border-radius: 12px 12px 0 0)
```

### 下拉刷新 (Pull to Refresh)

```
适用页面:
  - 列表页（应用列表、聊天列表）
  - Feed 流
  - 钱包余额页

行为:
  - 下拉 > 60px → 显示刷新指示器
  - 松手 → 触发刷新
  - 刷新中 → 显示 spinner
  - 完成 → spinner 消失，内容更新

注意:
  - 页面已在顶部时才触发（防止与滚动冲突）
  - 刷新间隔 ≥ 2s（防止频繁刷新）
```

### 骨架屏 (Skeleton)

```
所有数据加载页面必须用骨架屏代替空白/spinner:

  ✅ 骨架屏的形状 ≈ 真实内容的形状
  ✅ 使用脉冲动画（pulse animation）
  ✅ 骨架屏颜色用 --muted

  ❌ 不要全屏转圈 spinner（用户以为卡住了）
  ❌ 不要骨架屏+spinner 同时出现
```

### 空状态 (Empty State)

```
列表为空时不要白屏:

  ✅ 显示插图/图标 + 说明文字 + 操作按钮
  ✅ 例: "还没有安装应用" + [去应用商店看看] 按钮

  场景: 空列表、搜索无结果、网络错误、权限不足
```

---

## 22.9 WebView 注意事项（Phase 4）

### iOS WKWebView

```
限制:
  - 不支持 Service Worker（不能 PWA 离线）
  - 不支持 Web Push
  - 不支持 getUserMedia（除非原生桥接）
  - localStorage 在某些情况下会被清除
  - 第三方 Cookie 被阻止

适配:
  - 状态栏高度: window.screen.height - window.innerHeight
  - Safe Area: env() CSS 函数在 WKWebView 中有效
  - 回退按钮: 需要原生提供或自己实现
```

### Android WebView

```
限制:
  - 不同厂商 WebView 版本差异大
  - 部分低端机性能差（限制动画复杂度）
  - file:// 协议安全限制

适配:
  - 最低 Chrome 90+（覆盖 95%+ Android 设备）
  - 测试主流厂商: 小米/华为/OPPO/vivo/三星
  - 状态栏: 通过原生桥获取高度
```

### 原生桥接（Phase 4）

```
需要原生能力的场景:

  场景              Web 方案            原生桥接方案
  ─────────────────────────────────────────────────
  推送通知          Web Push（有限）     APNs / FCM
  生物识别          不支持              FaceID / 指纹
  相机              getUserMedia        原生相机
  分享              Web Share API       原生分享
  应用内支付        Stripe Web          Apple IAP / Google Pay
  深度链接          URL Scheme          Universal Links / App Links

桥接协议:
  window.NativeBridge.postMessage({ type, payload })
  → 与 SDK 的 postMessage 模式保持一致
```

---

## 22.10 设备测试矩阵

### 必测设备

| 优先级 | 设备 | 系统 | 浏览器 | 分辨率 |
|--------|------|------|--------|--------|
| **P0** | iPhone 15 | iOS 17 | Safari | 393×852 |
| **P0** | iPhone SE 3 | iOS 17 | Safari | 375×667 |
| **P0** | 任意 Android | Android 13+ | Chrome | 360×800 |
| **P1** | iPad Pro 11" | iPadOS 17 | Safari | 834×1194 |
| **P1** | Samsung Galaxy S24 | Android 14 | Chrome | 360×780 |
| **P1** | 小米/华为 中端机 | Android 12+ | 自带浏览器 | 360×800 |
| **P2** | iPad Mini | iPadOS 17 | Safari | 744×1133 |
| **P2** | 低端 Android | Android 11 | Chrome | 320×568 |

### Chrome DevTools 模拟

```
开发中用 DevTools 模拟（不替代真机测试）:

  快捷键: F12 → Ctrl+Shift+M (Toggle Device)

  必检设备:
    iPhone SE (375×667)     — 最小 iOS 屏幕
    iPhone 14 Pro (393×852) — 主流 iOS
    Pixel 7 (412×915)       — 主流 Android
    iPad Mini (768×1024)    — 平板断点

  必检功能:
    触控模拟、网络限速（3G/4G）、CPU 限速
```

---

## 22.11 三层架构中的责任划分

```
┌─ 第一层: 平台 Shell ───────────────────────────────┐
│  ✅ 平台负责:                                        │
│  - 顶部导航栏适配 Safe Area                          │
│  - 底部 Tab Bar 适配 Safe Area                       │
│  - 系统弹窗响应式（手机 = sheet，桌面 = dialog）       │
│  - 侧栏折叠逻辑                                      │
├─ 第二层: 平台功能页 ──────────────────────────────────┤
│  ✅ 平台负责:                                        │
│  - 所有页面 Mobile First 布局                        │
│  - 表单移动端适配                                     │
│  - 列表虚拟化                                         │
│  - 骨架屏 + 空状态                                   │
├─ 第三层: 应用 iframe ─────────────────────────────────┤
│  ⚠️ 应用开发者负责:                                   │
│  - SDK 文档写明移动端最佳实践                         │
│  - @billai/ui 组件库内置响应式                        │
│  - iframe 内 Safe Area 由平台 Shell 处理（应用不需要） │
│  - 应用审核时检查基本响应式（Phase 4）                │
└───────────────────────────────────────────────────────┘
```

---

## 22.12 Phase 规划

| 功能 | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|---------|
| Mobile First 断点系统 | — | ✅ | ✅ | ✅ | ✅ |
| 触控热区 ≥ 44px | — | ✅ | ✅ | ✅ | ✅ |
| Safe Area 适配 | — | ✅ | ✅ | ✅ | ✅ |
| 底部 Tab Bar | — | ✅ | ✅ | ✅ | ✅ |
| 虚拟键盘处理 | — | ✅ | ✅ | ✅ | ✅ |
| 输入类型优化 | — | ✅ | ✅ | ✅ | ✅ |
| 骨架屏 | — | — | ✅ | ✅ | ✅ |
| Bottom Sheet | — | — | ✅ | ✅ | ✅ |
| 下拉刷新 | — | — | ✅ | ✅ | ✅ |
| 路由级代码分割 | — | — | ✅ | ✅ | ✅ |
| Core Web Vitals 达标 | — | — | — | ✅ | ✅ |
| 真机测试 | — | — | — | ✅ | ✅ |
| WebView 适配 | — | — | — | — | ✅ |
| 原生桥接 | — | — | — | — | ✅ |
| 设备测试矩阵覆盖 | — | — | — | — | ✅ |
