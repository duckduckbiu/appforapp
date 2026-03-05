# Bill.ai 平台架构设计文档 v2.0

> **状态**: 设计稿（待评审）
> **日期**: 2026-03-04
> **版本**: v2.5 — 新增消息聚合层、动态聚合层（冷启动策略）
> **目标**: 将 Bill.ai 从社交平台转型为「应用工厂」，Rich Game 作为第一个插件应用接入。

---

## 总览

Bill.ai = **AI 时代的微信小程序平台**。用户安装一个 APP，通过 AI 或开发者生成无限定制应用。

### 五层角色体系

| 角色 | 说明 | 如何获得 |
|------|------|---------|
| **平台** | Bill.ai 本身 | — |
| **开发者** | 创建应用 | 创建第一个应用时自动解锁 |
| **频道主** | 运营频道，安装应用 | 创建第一个频道时自动解锁 |
| **推广者** | 推广应用/频道 | 生成推广链接时自动解锁 |
| **用户** | 使用应用 | 注册即是 |

### 三层技术架构

```
核心层    — 认证 · 路由 · 结算 · 安全 · 审核（Supabase）
功能层    — 社交 · 聊天 · Feed · 钱包 · 通知 · 商店（SDK 暴露）
应用层    — Rich Game · AI 生成应用 · 第三方应用（iframe 沙盒）
```

### 关键技术选型

| 层 | 技术 | 原因 |
|---|------|------|
| 平台后端 | Supabase | Auth + Realtime + Storage 开箱即用 |
| 应用后端 | Express（各应用自选） | 游戏等复杂逻辑需要自由度 |
| 应用沙盒 | iframe + postMessage | 浏览器原生隔离，Apple 4.7 合规 |
| 大文件存储 | Cloudflare R2 | 零流出流量费，自带全球 CDN |
| 登录方式 | 邮箱/Google/Apple | 面向大众用户，Apple 审核合规 |
| 钱包 | 绑定到用户设置 | 不再作为登录方式，作为充值/提现工具 |

---

## 文档目录

| # | 文件 | 内容 |
|---|------|------|
| 01 | [platform-core.md](./architecture/01-platform-core.md) | **愿景 · 角色 · 三层架构** — 平台定位、五层角色、法律架构、核心层/功能层/应用层 |
| 02 | [app-runtime.md](./architecture/02-app-runtime.md) | **SDK · 沙盒 · Manifest** — 完整 SDK 接口（12 个模块）、postMessage 协议、iframe 安全、应用清单格式 |
| 03 | [backend.md](./architecture/03-backend.md) | **后端架构** — 混合模式（Supabase + Express）、认证流转（邮箱/OAuth 登录）、App Token、钱包绑定 |
| 04 | [wallet.md](./architecture/04-wallet.md) | **钱包 · 双币** — 统一平台钱包、法币+加密货币、苹果抽成策略、KYC 三级、代码迁移计划 |
| 05 | [compliance.md](./architecture/05-compliance.md) | **合规 · 审核** — 年龄分级、举报系统、内容审核三层机制、地区限制、用户封禁、应用审核流程 |
| 06 | [roles-revenue.md](./architecture/06-roles-revenue.md) | **角色 · 分润** — 能力解锁模型、五方分账引擎、各角色 Dashboard、分润引擎伪代码 |
| 07 | [subscription.md](./architecture/07-subscription.md) | **订阅系统** — 四种订阅类型（平台/应用/频道/开发者）、套餐设计、自动续费引擎 |
| 08 | [promotion.md](./architecture/08-promotion.md) | **推广系统** — 推广链接、归因追踪、CPA/CPS 模式、推广者 Dashboard、防作弊 |
| 09 | [storage.md](./architecture/09-storage.md) | **存储服务** — 三层存储策略、Cloudflare R2、视频处理、配额管理 |
| 10 | [rich-game-migration.md](./architecture/10-rich-game-migration.md) | **Rich Game 改造** — 改动范围评估、5 步改造方案、保留独立运行能力 |
| 11 | [roadmap.md](./architecture/11-roadmap.md) | **路线图** — 目录结构、模块保留/删除/新增、Phase 0-4 详细规划 |
| 12 | [tech-decisions.md](./architecture/12-tech-decisions.md) | **技术决策 · 数据库** — 6 个关键决策记录、全部数据库表 SQL（30+ 张表） |
| 13 | [ui-design-system.md](./architecture/13-ui-design-system.md) | **UI · 设计系统** — 三层 UI 控制模型、Design Token、换肤机制、业务组件清单、`@billai/ui` 组件库 |
| 14 | [rating-system.md](./architecture/14-rating-system.md) | **评分系统** — 评分模型、贝叶斯加权、防刷策略、商店排序算法、开发者回复、SDK 评分引导 |
| 15 | [admin-panels.md](./architecture/15-admin-panels.md) | **后台管理** — 平台管理后台、开发者控制台、频道主/推广者 Dashboard、应用自有后台 |
| 16 | [ai-app-factory.md](./architecture/16-ai-app-factory.md) | **AI 应用工厂** — 四层生成策略、模板系统、安全约束、迭代对话、托管方案 |
| 17 | [notification-search-i18n.md](./architecture/17-notification-search-i18n.md) | **通知 · 搜索 · i18n · API 版本** — 统一通知管道、PostgreSQL 全文搜索、国际化策略、SDK/API 版本控制 |
| 18 | [security-ops.md](./architecture/18-security-ops.md) | **安全 · 运营基础设施** — 五层安全模型、埋点体系、错误监控、邮件系统、法律文档框架 |
| 19 | [accessibility.md](./architecture/19-accessibility.md) | **无障碍规范** — WCAG 2.1 AA 目标、色彩对比度、键盘导航、ARIA、焦点管理、动画规范、测试审计 |
| 20 | [testing-strategy.md](./architecture/20-testing-strategy.md) | **测试策略** — 测试金字塔、覆盖率目标、单元/集成/E2E 规范、Mock 策略、测试数据、CI 集成 |
| 21 | [cicd-pipeline.md](./architecture/21-cicd-pipeline.md) | **CI/CD 流水线** — Pre-commit Hooks、GitHub Actions、Branch Protection、部署/回滚策略、Dependabot、PR/Issue 模板 |
| 22 | [mobile-design.md](./architecture/22-mobile-design.md) | **移动端设计规范** — 断点系统、触控交互、Safe Area、导航模式、虚拟键盘、性能指标、WebView 适配 |
| 23 | [message-aggregation.md](./architecture/23-message-aggregation.md) | **消息聚合层** — 协议库桥接（Telegram/WhatsApp/Discord）、统一消息格式、Bridge 服务架构、安全考量 |
| 24 | [feed-aggregation.md](./architecture/24-feed-aggregation.md) | **动态聚合层** — RSS/HN/Reddit 公开内容抓取、冷启动策略、混合 Feed（聚合+UGC）、未登录浏览、互动权限 |

---

## 收入模型总览

```
Bill.ai 平台的 6 条收入线:

  1. 交易抽成     — 每笔应用内交易抽 5%（平台 Manifest 固定）
  2. 平台订阅     — Bill.ai Pro $9.99/月、Max $19.99/月
  3. 开发者订阅   — Dev Pro $29/月、Enterprise $99/月
  4. 存储超额     — 超出免费额度按量计费
  5. 应用上架费   — 高级审核通道（可选，Phase 4）
  6. 广告系统     — 免费用户展示广告（Phase 4+）

每笔应用交易的分账:
  平台 5% + 开发者 70% + 频道主 15% + 推广者 5% + 应用自留 5%
  （没有频道主/推广者时，其份额归开发者）
```

---

## 开发阶段速览

| Phase | 目标 | 周期 | 关键交付 |
|-------|------|------|---------|
| **0** | 架构验证 | 1 周 | iframe + SDK 通信跑通 |
| **1** | 平台搭建 | 2-3 周 | 应用商店 + 频道 + 分润 + 合规骨架 |
| **2** | Rich Game 迁入 | 1-2 周 | Rich Game 完全在 Bill.ai 内运行 |
| **3** | 功能完善 | 2-3 周 | 社交/聊天/Feed + 内容审核 + 法币 |
| **4** | AI 生成 + 上架 | 3-4 周 | AI 应用工厂 + Apple/Google 上架 |

> 详见 [11-roadmap.md](./architecture/11-roadmap.md)

---

> **本文档是 Bill.ai 平台的架构基石。所有后续开发必须遵循本文档中的设计决策和接口规范。**
>
> 如有修改需求，必须经过评审并更新本文档。
