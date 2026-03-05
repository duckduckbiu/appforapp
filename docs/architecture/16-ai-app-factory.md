# 16 — AI 应用工厂

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。
> **状态**: 愿景文档（Phase 4 实现，当前仅保留方向和框架骨架）

---

## 16.1 核心愿景

用户用自然语言描述需求 → AI 生成可运行的应用 → 发布到 Bill.ai 应用商店。

**不是让 AI 从零写代码，而是让 AI 在约束框架里"选模板 → 填配置 → 组装组件 → 生成代码"。**

---

## 16.2 四层渐进策略

从简单到复杂，逐层推进。每一层都是上一层的超集。

```
Phase 4a ─── 📋 模板 + 配置     AI 选模板 → 填 JSON → 秒级生成
Phase 4b ─── 🧩 组件组装        AI 从组件库挑选 → 排列组合 → 生成页面
Phase 4c ─── 🔧 代码生成        AI 生成完整 React SPA（受约束）
Phase 4d ─── 🧠 全栈生成        AI 生成前端 + Serverless 后端 + DB Schema
```

**建议从 4a 起步**——最可靠、最快落地、AI 出错率最低。

### 各层对比

| 层次 | AI 输出 | 生成速度 | 可靠性 | 灵活性 |
|------|---------|---------|--------|--------|
| 4a 模板+配置 | JSON 配置文件 | 1-2 秒 | 极高 | 低（受模板限制） |
| 4b 组件组装 | 页面组装描述 | 3-5 秒 | 高 | 中 |
| 4c 代码生成 | React 源码 | 5-15 秒 | 中 | 高 |
| 4d 全栈生成 | 前端+后端+DB | 15-30 秒 | 低 | 极高 |

---

## 16.3 生成引擎六层架构

```
① 需求理解    用户自然语言 → LLM → 结构化需求（类型/功能/复杂度）
      ↓
② 策略决策    根据复杂度选择 4a/4b/4c/4d
      ↓
③ 生成执行    模板引擎 / 组件组装器 / 代码生成器
      ↓
④ 安全审核    静态扫描 + 依赖检查 + 内容审核 + Manifest 验证
      ↓
⑤ 构建部署    esbuild 打包 → R2 托管 → 注册到商店
      ↓
⑥ 迭代对话    用户看预览 → 提修改意见 → AI 最小化改动 → 重新构建
```

---

## 16.4 模板系统设计（4a 核心）

### 模板结构

```typescript
interface AppTemplate {
  id: string;                    // 'poll', 'quiz', 'shop'
  name: string;                  // 显示名
  category: string;              // 分类
  configSchema: JSONSchema;      // 配置项的 Schema（AI 按此填写）
  defaultConfig: object;         // 默认配置
  entryFile: string;             // 模板入口
}
```

### 首批模板方向（15-20 个）

| 类型 | 示例 |
|------|------|
| 互动 | 投票/问卷、抽奖/转盘、排行榜、签到打卡 |
| 内容 | 图文展示、个人主页(Link-in-bio)、活动页 |
| 工具 | 计算器、倒计时、预约/日历、表单收集 |
| 电商 | 商品目录、下单页、优惠券 |
| 游戏 | 问答测验、刮刮卡、记忆翻牌 |
| 社交 | 留言板、弹幕墙、心愿墙 |

---

## 16.5 代码生成约束（4c 核心）

AI 生成的代码必须在以下约束内，确保安全和平台兼容：

```
允许的 import:
  react, react-dom, @billai/app-sdk, @billai/ui, date-fns

禁止的 API:
  eval, Function, document.cookie, localStorage,
  fetch (必须用 SDK), XMLHttpRequest, window.open, postMessage

限制:
  最多 20 个文件, 总大小 ≤ 500KB
  必须使用 SDK 访问平台功能（用户/钱包/存储/社交）
  不能包含硬编码密钥或敏感信息
```

---

## 16.6 安全审核管道

所有 AI 生成的应用在发布前必须通过自动审核：

```
生成完成 → 静态代码扫描（禁用 API 检测）
         → 依赖安全检查（无恶意包）
         → 内容审核（文本/图片 NSFW 检测）
         → Manifest 合规验证（年龄分级/权限声明）
         → 包大小检查（≤ 限额）
         → [通过] → 发布
         → [失败] → 告知用户原因，AI 自动修复后重试
```

---

## 16.7 生成应用的托管

| 层次 | 托管方式 |
|------|---------|
| 4a 模板 | 模板在平台 CDN，配置存 DB，运行时渲染 |
| 4b/4c | 编译后上传 Cloudflare R2，URL: `apps.billai.app/{app_id}/` |
| 4d 全栈 | 前端上 R2，后端用 Supabase Edge Functions |

所有生成应用通过 iframe 沙盒加载，与平台隔离，复用现有的应用运行时（见 [02-app-runtime.md](./02-app-runtime.md)）。

---

## 16.8 用户交互流程

```
"创建应用" → 自然语言描述需求
           → AI 生成（2-15秒）
           → 预览（iframe 内实时展示）
           → 迭代对话（"改颜色"、"加功能"、"换布局"）
           → 满意后发布到商店 / 分享到频道
```

迭代对话是核心体验——用户不需要一次说清所有需求。

---

## 16.9 LLM 选型方向

| 环节 | 要求 | 方向 |
|------|------|------|
| 需求理解 | 强语义理解 | GPT-4o / Claude 级别 |
| 配置填写 | 快、便宜 | GPT-4o-mini 级别 |
| 代码生成 | 代码质量 | Claude / GPT-4o 级别 |
| 迭代修改 | 速度优先 | GPT-4o-mini 级别 |

通过 OpenRouter 统一接入，按任务类型动态选模型。

---

## 16.10 前置依赖

AI 应用工厂依赖以下模块先完成：

| 依赖 | 文档 | 说明 |
|------|------|------|
| 应用运行时 | 02-app-runtime.md | iframe 沙盒 + SDK + postMessage |
| App SDK | 02-app-runtime.md | `@billai/app-sdk` npm 包 |
| UI 组件库 | 13-ui-design-system.md | `@billai/ui` 组件库 |
| 存储服务 | 09-storage.md | R2 托管生成的应用文件 |
| 应用审核 | 05-compliance.md | 自动审核管道 |
| 应用商店 | 12-tech-decisions.md | apps 表 + 发布流程 |

**实现顺序**: Phase 0-3 完成以上基础 → Phase 4 实现 AI 生成。

---

## 16.11 数据库表（预留）

```sql
-- AI 生成的应用记录
CREATE TABLE ai_generated_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT REFERENCES apps(app_id),     -- 关联应用商店
  creator_id UUID REFERENCES profiles(id) NOT NULL,
  generation_method TEXT NOT NULL,          -- 'template' / 'assembly' / 'codegen' / 'fullstack'
  template_id TEXT,                         -- 使用的模板（4a）
  user_prompt TEXT NOT NULL,               -- 用户原始需求描述
  config JSONB,                            -- 生成的配置
  source_files JSONB,                      -- 生成的源文件清单
  model_used TEXT,                         -- 使用的 LLM 模型
  generation_time_ms INTEGER,              -- 生成耗时
  iteration_count INTEGER DEFAULT 0,       -- 迭代次数
  status TEXT DEFAULT 'draft',             -- draft / published / failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 迭代对话历史
CREATE TABLE ai_generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_app_id UUID REFERENCES ai_generated_apps(id) NOT NULL,
  role TEXT NOT NULL,                      -- 'user' / 'assistant'
  content TEXT NOT NULL,
  changes_made JSONB,                      -- AI 做了什么改动
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 应用模板注册（4a）
CREATE TABLE app_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  config_schema JSONB NOT NULL,            -- JSON Schema
  default_config JSONB NOT NULL,
  entry_url TEXT NOT NULL,
  preview_url TEXT,
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

> **本文档为愿景级设计，Phase 4 开始实现时再补充具体实现细节。**
> 当前阶段（Phase 0-3）的重点是把应用运行时、SDK、组件库等基础设施做好——这些是 AI 应用工厂的前置依赖。
