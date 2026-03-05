# 21 — CI/CD 流水线

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。
> CI/CD = 代码质量的最后一道自动化防线。没有它，任何人的一次 push 就能搞挂生产。

---

## 21.1 架构总览

```
开发者本地
  │
  ├── pre-commit hook ──→ lint + format + typecheck（秒级）
  │
  ├── git push ──────────→ GitHub
  │                          │
  │                    ┌─────┴─────┐
  │                    │  PR 创建   │
  │                    └─────┬─────┘
  │                          │
  │                    ┌─────┴──────────────────────┐
  │                    │  GitHub Actions CI          │
  │                    │                             │
  │                    │  ① Lint + Format Check      │
  │                    │  ② TypeScript Type Check    │
  │                    │  ③ Unit Tests + Coverage    │
  │                    │  ④ Integration Tests        │
  │                    │  ⑤ Build Validation         │
  │                    │  ⑥ Security Audit           │
  │                    └─────┬──────────────────────┘
  │                          │
  │                    ┌─────┴─────┐
  │                    │ 全部通过？  │
  │                    └──┬────┬───┘
  │                   Yes │    │ No
  │                       │    └──→ PR 被阻止合并
  │                       │
  │                 ┌─────┴─────┐
  │                 │ Code Review│
  │                 │ ≥1 Approve │
  │                 └─────┬─────┘
  │                       │
  │                 ┌─────┴─────┐
  │                 │ Merge to  │
  │                 │   main    │
  │                 └─────┬─────┘
  │                       │
  │               ┌───────┴────────┐
  │               │ Railway 自动    │
  │               │ 拉取 + 构建    │
  │               │ + 部署         │
  │               └───────┬────────┘
  │                       │
  │               ┌───────┴────────┐
  │               │  Production    │
  │               │  Health Check  │
  │               └────────────────┘
```

---

## 21.2 本地开发 — Pre-commit Hooks

### 工具链

```
Husky（Git Hook 管理）+ lint-staged（只检查暂存文件）

安装:
  npm install -D husky lint-staged
  npx husky init
```

### 配置

```json
// package.json（根目录）
{
  "lint-staged": {
    "backend/src/**/*.ts": [
      "eslint --fix",
      "prettier --write"
    ],
    "frontend/src/**/*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "admin/src/**/*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

```bash
# .husky/pre-push（可选，较慢）
cd backend && npm run typecheck
cd backend && npm test
```

### 为什么不在 pre-commit 跑测试

```
pre-commit 必须快（< 5s），否则开发者会 --no-verify 跳过:
  ✅ lint + format（< 3s，只检查暂存文件）
  ❌ typecheck（10-20s，太慢）
  ❌ 测试（30s+，太慢）

typecheck 和测试放在 CI 中强制执行，不可跳过。
```

---

## 21.3 GitHub Actions — CI 流水线

### 主流水线: PR 检查

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

# 同一个 PR 的新 push 取消旧的运行
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ─── 阶段 1: 快速检查（并行）───────────────
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json
            admin/package-lock.json
      - run: cd backend && npm ci
      - run: cd frontend && npm ci
      - run: cd admin && npm ci
      - run: cd backend && npx eslint src/
      - run: cd frontend && npx eslint src/
      - run: cd admin && npx eslint src/

  typecheck:
    name: TypeScript Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: cd backend && npm ci && npm run typecheck
      - run: cd frontend && npm ci && npm run build  # Vite build 包含类型检查
      - run: cd admin && npm ci && npm run build

  # ─── 阶段 2: 测试 ──────────────────────────
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: cd backend && npm ci
      - run: cd backend && npm test -- --coverage
      - name: Upload Coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: backend/coverage/

  integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: test
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test_richgame
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/test_richgame
      JWT_SECRET: test-secret-for-ci
      ADMIN_PASSWORD: test-admin-password
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: cd backend && npm ci
      - run: cd backend && npm run test:integration

  # ─── 阶段 3: 安全检查 ─────────────────────
  security:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd backend && npm audit --audit-level=high
      - run: cd frontend && npm audit --audit-level=high
      - run: cd admin && npm audit --audit-level=high

  # ─── 阶段 4: 构建验证 ─────────────────────
  build:
    name: Docker Build
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker Image
        run: docker build -t richgame:ci-${{ github.sha }} .
```

### Branch Protection Rules

```
main 分支保护规则:

  ✅ Require pull request before merging
  ✅ Require approvals: 1
  ✅ Dismiss stale reviews on new push
  ✅ Require status checks to pass:
     - lint
     - typecheck
     - test
     - integration
     - security
     - build
  ✅ Require branch to be up-to-date
  ❌ Require signed commits（Phase 4 再考虑）
  ❌ Require linear history（允许 merge commit）
```

---

## 21.4 CD — 部署流程

### 当前架构（Railway）

```
Push to main
  → Railway 自动拉取
  → Docker Build（Dockerfile）
  → Health Check（/health endpoint）
  → Blue-Green Deploy（Railway 内置）
  → 旧实例在新实例就绪后停止
```

### 部署安全策略

```
Phase 1（当前）:
  main → 直接部署生产（Railway 自动）
  适合: 小团队、快速迭代

Phase 3（引入 staging）:
  main → 部署到 staging（自动）
  staging 验证通过 → 手动触发生产部署

Phase 4（上架后）:
  main → staging（自动）
  staging → canary（5% 流量）→ 观察 → 全量
```

### 环境管理

| 环境 | 用途 | 触发 | 数据库 | 阶段 |
|------|------|------|--------|------|
| **local** | 开发调试 | 手动 `npm start` | 本地 PostgreSQL | Phase 0 |
| **CI** | 自动化测试 | PR / Push | GitHub Actions 中的临时 PG | Phase 1 |
| **staging** | 上线前验证 | Push to main | 独立 Railway PG | Phase 3 |
| **production** | 线上服务 | 手动/自动 | Railway PG | Phase 1 |

### 环境变量管理

```
原则:
  1. 开发环境: .env 文件（本地，不入库）
  2. CI 环境: GitHub Secrets（在 workflow 中引用）
  3. 生产环境: Railway 环境变量（加密存储）
  4. 不同环境使用不同的密钥（JWT_SECRET, ADMIN_PASSWORD 等）
  5. VITE_* 变量在构建时注入（修改后必须重新部署）

安全规则:
  - 生产密钥只有 owner 能查看/修改
  - CI 密钥有最小权限（只能跑测试）
  - 密钥不能出现在日志中（CI output 自动 mask）
```

---

## 21.5 回滚策略

### 快速回滚（< 2 分钟）

```
方案 1: Railway 回滚（推荐）
  Railway Dashboard → Deployments → 选择上一个成功部署 → Rollback
  → 无需代码操作，1 分钟内完成

方案 2: Git Revert
  git revert HEAD
  git push origin main
  → Railway 自动部署 revert 后的版本

方案 3: 重新部署指定 commit
  Railway CLI: railway up --commit <sha>
```

### 回滚决策

```
何时回滚:
  - API 错误率 > 10% 持续 5 分钟
  - 核心功能不可用（登录、支付、游戏）
  - 数据库迁移导致数据异常

何时不回滚（修复前进）:
  - 非核心功能 bug（UI 显示、翻译错误）
  - 性能下降但仍在 SLO 内
  - 新功能有小问题但不影响现有功能
```

### 数据库回滚注意

```
⚠️ 数据库变更是单向的（不可自动回滚）

安全变更（可以 hotfix）:
  - ADD COLUMN（新列有默认值）
  - CREATE TABLE
  - CREATE INDEX CONCURRENTLY

危险变更（必须谨慎）:
  - DROP COLUMN → 先停止使用 → 下个版本再删
  - ALTER COLUMN TYPE → 可能锁表
  - DROP TABLE → 先重命名为 _deprecated → 观察一周 → 再删

Phase 3 目标: 引入正式迁移系统（Prisma Migrate 或 node-pg-migrate）
  → 每次变更有版本号
  → 可以写 down migration 回滚
```

---

## 21.6 Dependabot — 依赖自动更新

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "backend"
    groups:
      production:
        dependency-type: "production"
      development:
        dependency-type: "development"

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 3
    labels:
      - "dependencies"
      - "frontend"

  - package-ecosystem: "npm"
    directory: "/admin"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 3
    labels:
      - "dependencies"
      - "admin"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

---

## 21.7 PR 模板 & Issue 模板

### PR 模板

```markdown
<!-- .github/pull_request_template.md -->

## 变更说明

<!-- 简述做了什么、为什么做 -->

## 变更类型

- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 文档 (docs)
- [ ] 测试 (test)
- [ ] 配置/构建 (chore)

## 涉及模块

- [ ] Backend
- [ ] Frontend
- [ ] Admin
- [ ] Database (迁移)
- [ ] CI/CD

## 测试

- [ ] 新增/更新了测试
- [ ] 本地 `npm test` 全部通过
- [ ] 本地 `npm run typecheck` 通过
- [ ] 已自测核心流程

## 检查清单

- [ ] 如有新 API: 更新了 `docs/API.md`
- [ ] 如有 DB 变更: 更新了 `memory/db-schema.md`
- [ ] 如有新依赖: 更新了 `.claude/commands/services.md`
- [ ] 更新了 `HANDOFF.md`
```

### Issue 模板

```markdown
<!-- .github/ISSUE_TEMPLATE/bug_report.md -->
---
name: Bug Report
about: 报告一个问题
labels: bug
---

## 描述

<!-- 发生了什么 -->

## 复现步骤

1.
2.
3.

## 期望行为

<!-- 应该发生什么 -->

## 实际行为

<!-- 实际发生了什么 -->

## 环境

- 浏览器:
- 设备:
- 版本/commit:
```

```markdown
<!-- .github/ISSUE_TEMPLATE/feature_request.md -->
---
name: Feature Request
about: 提出一个新功能
labels: enhancement
---

## 需求描述

<!-- 要解决什么问题 -->

## 期望方案

<!-- 你希望怎么实现 -->

## 备选方案

<!-- 有没有其他方式 -->
```

---

## 21.8 Commit 规范

### Conventional Commits

```
格式: <type>(<scope>): <description>

type:
  feat      新功能
  fix       Bug 修复
  refactor  重构（不改变行为）
  docs      文档
  test      测试
  chore     构建/配置/依赖
  perf      性能优化
  style     代码格式（不影响逻辑）

scope（可选）:
  auth, game, wallet, admin, frontend, db, ci

示例:
  feat(wallet): add deposit address generation
  fix(game): prevent double voting in same round
  refactor(admin): split routes into domain modules
  docs: update API documentation for balance endpoints
  test(auth): add integration tests for nonce verification
  chore(ci): add GitHub Actions workflow
```

### 为什么用 Conventional Commits

```
1. 自动生成 CHANGELOG（Phase 3）
2. 自动判断版本号（SemVer: feat → minor, fix → patch）
3. PR 里一眼看出变更性质
4. git log 可按 type 过滤
```

---

## 21.9 监控部署结果

### 部署后自动检查

```
Railway 部署完成后（通过 Webhook 或手动）:

  1. Health Check: curl https://rich-game-production.up.railway.app/health
     → 返回 {"status":"ok","checks":{"database":"ok"}}

  2. Smoke Test（关键接口快速验证）:
     → GET /api/game/config → 200
     → GET /api/game/rooms → 200
     → WebSocket 连接测试

  3. 错误率观察:
     → Sentry: 部署后 5 分钟内新错误数 < 5
     → 如果突增 → 考虑回滚
```

### 通知

```
部署通知渠道:
  Phase 1: GitHub Actions status（邮件通知 + commit 状态）
  Phase 3: Slack/Discord webhook（#deployments 频道）

通知内容:
  ✅ 部署成功: "v1.2.3 deployed to production (commit abc123)"
  ❌ 部署失败: "Deploy failed: build error in step 3" + 链接到 CI 日志
  ⚠️ 回滚: "Rolled back to v1.2.2 due to elevated error rate"
```

---

## 21.10 Phase 规划

| 功能 | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|---------|
| Railway 自动部署 | ✅ 已有 | ✅ | ✅ | ✅ | ✅ |
| GitHub Actions CI（lint+test+build） | — | ✅ | ✅ | ✅ | ✅ |
| Branch Protection Rules | — | ✅ | ✅ | ✅ | ✅ |
| Husky + lint-staged | — | ✅ | ✅ | ✅ | ✅ |
| PR / Issue 模板 | — | ✅ | ✅ | ✅ | ✅ |
| Dependabot | — | ✅ | ✅ | ✅ | ✅ |
| Conventional Commits | — | ✅ | ✅ | ✅ | ✅ |
| 集成测试（CI 中 PostgreSQL） | — | — | ✅ | ✅ | ✅ |
| E2E 测试（Playwright in CI） | — | — | ✅ | ✅ | ✅ |
| Staging 环境 | — | — | — | ✅ | ✅ |
| 部署通知（Slack/Discord） | — | — | — | ✅ | ✅ |
| Canary 部署 | — | — | — | — | ✅ |
| 正式 DB 迁移系统 | — | — | — | ✅ | ✅ |
| 自动 CHANGELOG 生成 | — | — | — | — | ✅ |
