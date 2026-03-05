# 20 — 测试策略

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。
> 没有测试的代码 = 不可信的代码。测试不是"写完再补"，而是开发流程的一部分。

---

## 20.1 测试金字塔

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E ╲          少量（5-10 个核心流程）
                 ╱________╲        ↑ 慢、贵、脆弱
                ╱          ╲
               ╱ Integration ╲     中量（每个 API 端点 + 关键交互）
              ╱______________╲     ↑ 中等速度
             ╱                ╲
            ╱    Unit Tests    ╲   大量（每个函数/组件的边界情况）
           ╱____________________╲  ↑ 快、稳、多

目标比例:
  单元测试    ≈ 70%
  集成测试    ≈ 20%
  E2E 测试   ≈ 10%
```

---

## 20.2 覆盖率目标

### 整体目标

| 指标 | Phase 1 | Phase 2 | Phase 3 | Phase 4（上架） |
|------|---------|---------|---------|----------------|
| 行覆盖率 (Line) | ≥ 40% | ≥ 55% | ≥ 65% | ≥ 75% |
| 分支覆盖率 (Branch) | ≥ 30% | ≥ 45% | ≥ 55% | ≥ 65% |

### 分模块最低要求

| 模块 | 最低行覆盖率 | 原因 |
|------|-------------|------|
| **认证 (auth)** | 90% | 安全核心，不能有漏洞 |
| **支付/结算 (wallet, revenue)** | 85% | 涉及资金，算错 = 赔钱 |
| **分润引擎 (split engine)** | 90% | 五方分账，精度要求极高 |
| **游戏逻辑 (game logic)** | 80% | 规则正确性直接影响用户体验 |
| **API 路由 (routes)** | 60% | 接口行为需可预测 |
| **前端组件 (UI)** | 50% | 关键交互组件需测试 |
| **工具函数 (utils)** | 80% | 复用率高，边界多 |

### 不要追 100%

```
100% 覆盖率 ≠ 没有 bug
不值得测的:
  - 纯配置文件（config.ts 的常量定义）
  - 纯类型定义（interface、type）
  - 简单的样式组件（无逻辑的 wrapper）
  - 第三方库的封装（测库本身没意义）
```

---

## 20.3 单元测试

### 框架选型

| 层 | 框架 | 原因 |
|---|------|------|
| 后端 | **Vitest** | 已在用，与 TypeScript/ESM 兼容好 |
| 前端/Admin | **Vitest + React Testing Library** | 同一套工具链，测组件行为而非实现 |

### 后端单元测试规范

```typescript
// 文件命名: src/{module}/__tests__/{module}.test.ts
// 示例: src/game/__tests__/fee-calculation.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateFee, calculateRevenueSplit } from '../fee.service';

describe('calculateFee', () => {
  // 正常路径
  it('should calculate 5% platform fee on 10 USDC', () => {
    const fee = calculateFee(10_000_000, 500); // 10 USDC, 5% bps
    expect(fee).toBe(500_000); // 0.5 USDC
  });

  // 边界值
  it('should return 0 fee for 0 amount', () => {
    expect(calculateFee(0, 500)).toBe(0);
  });

  // 精度
  it('should handle micro-USDC precision without floating point errors', () => {
    const fee = calculateFee(1, 500); // 最小单位
    expect(fee).toBe(0); // 向下取整
  });

  // 异常
  it('should throw on negative amount', () => {
    expect(() => calculateFee(-1, 500)).toThrow();
  });
});
```

### 测试命名规范

```
格式: should {expected behavior} when {condition}

✅ should return 401 when token is expired
✅ should split revenue 5 ways when all roles present
✅ should fall back to default config when DB unreachable
✅ should reject vote after round ends

❌ test fee calculation       （太笼统）
❌ it works                   （毫无信息量）
❌ test1, test2               （编号命名）
```

### Mock 策略

```
核心原则: 只 mock 外部依赖，不 mock 被测代码内部逻辑

必须 Mock:
  ├── 数据库查询（pg pool.query）
  ├── 外部 API（Supabase, Resend, Cloudflare R2）
  ├── 区块链 RPC 调用
  ├── 时间（Date.now → vi.useFakeTimers）
  └── 随机数（Math.random → vi.spyOn）

不要 Mock:
  ├── 被测函数调用的其他内部函数（测真实行为）
  ├── 工具函数（sanitize, format 等）
  └── 配置读取（用测试专用配置文件）

Mock 工具:
  vi.mock('模块路径')        — 模块级 mock
  vi.spyOn(对象, '方法')     — 方法级 spy
  vi.fn()                   — 创建 mock 函数
  vi.useFakeTimers()        — 时间控制
```

### 前端组件测试规范

```typescript
// 文件命名: src/components/__tests__/AppCard.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { AppCard } from '../AppCard';

describe('AppCard', () => {
  const mockApp = {
    id: 'rich-game',
    name: 'Rich Game',
    rating: 4.5,
    installs: 1200,
    ageRating: '12+',
  };

  it('should display app name and rating', () => {
    render(<AppCard app={mockApp} />);
    expect(screen.getByText('Rich Game')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('should call onInstall when install button is clicked', async () => {
    const onInstall = vi.fn();
    render(<AppCard app={mockApp} onInstall={onInstall} />);
    await fireEvent.click(screen.getByRole('button', { name: /安装/ }));
    expect(onInstall).toHaveBeenCalledWith('rich-game');
  });

  // 测试行为，不测试实现
  // ✅ getByRole, getByText, getByLabelText
  // ❌ getByClassName, container.querySelector
});
```

---

## 20.4 集成测试

### API 集成测试（后端）

```typescript
// 框架: Vitest + supertest
// 文件: src/{module}/__tests__/{module}.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../index'; // Express app factory

describe('POST /auth/verify', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp({ database: 'test_richgame' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return JWT token for valid signature', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({ address: '0x...', signature: '0x...', message: '...' })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body.token).toMatch(/^eyJ/); // JWT format
  });

  it('should return 401 for invalid signature', async () => {
    await request(app)
      .post('/auth/verify')
      .send({ address: '0x...', signature: 'invalid', message: '...' })
      .expect(401);
  });

  it('should return 429 when rate limited', async () => {
    // 连续发 11 次请求（限制 10/min）
    for (let i = 0; i < 11; i++) {
      await request(app).post('/auth/verify').send({});
    }
    // 第 11 次应该被限流
    const res = await request(app).post('/auth/verify').send({});
    expect(res.status).toBe(429);
  });
});
```

### 数据库集成测试

```
策略: 使用独立的测试数据库

setup:
  1. 创建 test_richgame 数据库（CI 中自动创建）
  2. 运行 migrate()（复用生产迁移逻辑）
  3. 插入 seed data（固定的测试数据集）

teardown:
  4. 每个测试用 transaction + rollback（不污染数据）
  或: 每个测试文件清空相关表

环境变量:
  TEST_DATABASE_URL=postgresql://localhost:5432/test_richgame
```

### WebSocket 集成测试

```typescript
import { WebSocket } from 'ws';

describe('WebSocket Game Events', () => {
  it('should broadcast vote results to all players', async () => {
    const ws1 = new WebSocket('ws://localhost:4000');
    const ws2 = new WebSocket('ws://localhost:4000');

    // 加入同一游戏
    ws1.send(JSON.stringify({ type: 'join', gameId: 'test-game' }));
    ws2.send(JSON.stringify({ type: 'join', gameId: 'test-game' }));

    // ws1 投票
    ws1.send(JSON.stringify({ type: 'vote', vote: 'red' }));

    // ws2 应该收到投票通知
    const msg = await waitForMessage(ws2, 'vote_update');
    expect(msg.data.totalVotes).toBe(1);
  });
});
```

---

## 20.5 E2E 测试

### 框架选型

| 方案 | 特点 | 建议 |
|------|------|------|
| **Playwright** | 多浏览器、快、稳定、微软维护 | ✅ 推荐 |
| Cypress | 社区大、调试友好、但只支持 Chrome 系 | 备选 |

### 核心 E2E 场景（必测清单）

```
用户核心路径（P0 — 不能挂）:

  1. 注册 → 登录 → 看到首页
  2. 浏览应用商店 → 安装应用 → 打开应用
  3. 进入 Rich Game → 加入房间 → 投票 → 看到结果
  4. 钱包充值 → 余额更新 → 提现申请
  5. 用户设置 → 修改昵称 → 绑定钱包

管理员路径（P1）:

  6. Admin 登录 → 查看 Dashboard
  7. 审核应用 → 通过/拒绝
  8. 查看用户 → 封禁/解封

开发者路径（P2）:

  9. 创建应用 → 上传 → 提交审核
  10. 开发者 Dashboard → 查看收入
```

### E2E 测试规范

```typescript
// 文件: e2e/tests/user-registration.spec.ts

import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test('should complete registration via email', async ({ page }) => {
    await page.goto('/');
    await page.click('text=注册');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'SecurePass123!');
    await page.click('button[type=submit]');

    // 验证跳转到首页
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid=user-menu]')).toBeVisible();
  });
});
```

### E2E 环境

```
独立的测试环境:
  - 数据库: test_richgame（每次运行前 reset）
  - 后端: 测试模式启动（禁用外部 API 调用）
  - 前端: 指向测试后端

CI 中运行:
  - GitHub Actions → 启动 Docker Compose（DB + Backend + Frontend）
  - Playwright 在 headless Chrome 中执行
  - 失败时保存截图 + trace 到 artifacts
```

---

## 20.6 特殊测试类型

### 快照测试（Snapshot）

```
适用: 邮件模板、API 响应格式、配置输出
不适用: UI 组件（频繁变化，维护成本高）

用法:
  expect(emailTemplate.render(data)).toMatchSnapshot();
  expect(apiResponse).toMatchSnapshot();
```

### 性能测试 / 压测

```
工具: k6 (Grafana Labs, 开源)

场景:
  - 100 并发用户加入游戏房间
  - 1000 并发 WebSocket 连接
  - 50 笔/秒交易结算

SLO 目标:
  - API P50 < 100ms, P95 < 300ms, P99 < 1s
  - WebSocket 消息延迟 P95 < 200ms
  - 数据库查询 P95 < 50ms

阶段:
  Phase 2: 手动跑 k6 脚本验证关键路径
  Phase 3: CI 中定期跑性能回归（每周）
  Phase 4: 上架前全量压测
```

### 安全测试

```
静态分析:
  - npm audit（依赖漏洞）→ CI 中每次构建
  - ESLint security 规则 → 编码时

动态分析:
  - OWASP ZAP（自动化扫描）→ Phase 3 起每月
  - 手动渗透测试 → Phase 4 上架前

阶段:
  Phase 1: npm audit + ESLint 基础规则
  Phase 3: OWASP ZAP 自动化 + Dependabot
  Phase 4: 外部安全审计（如果预算允许）
```

---

## 20.7 测试数据管理

### Seed Data（种子数据）

```typescript
// backend/src/db/seed.ts

export async function seedTestData(pool: Pool) {
  // 固定的测试用户
  await pool.query(`
    INSERT INTO users (address, nickname, avatar_type)
    VALUES
      ('0xTestUser1', 'Alice', 'identicon'),
      ('0xTestUser2', 'Bob', 'identicon'),
      ('0xTestAdmin', 'Admin', 'identicon')
    ON CONFLICT DO NOTHING
  `);

  // 固定的测试游戏
  await pool.query(`
    INSERT INTO games (game_chain_id, tier, status, creator_address)
    VALUES ('game_test_001', 5000000, 'waiting', '0xTestUser1')
    ON CONFLICT DO NOTHING
  `);

  // 固定的平台配置
  await pool.query(`
    INSERT INTO platform_config (key, value)
    VALUES ('platform_fee_bps', '500')
    ON CONFLICT DO NOTHING
  `);
}
```

### Factory Pattern（工厂模式）

```typescript
// backend/src/test/factories.ts

export function createTestUser(overrides?: Partial<User>): User {
  return {
    address: `0x${randomHex(40)}`,
    nickname: `User_${randomInt(1000)}`,
    avatar_type: 'identicon',
    created_at: new Date(),
    ...overrides,
  };
}

export function createTestGame(overrides?: Partial<Game>): Game {
  return {
    game_chain_id: `game_test_${randomInt(10000)}`,
    tier: 5_000_000,
    status: 'waiting',
    creator_address: '0xTestUser1',
    ...overrides,
  };
}

// 使用:
const user = createTestUser({ nickname: 'VIP用户' });
const game = createTestGame({ status: 'active', tier: 10_000_000 });
```

---

## 20.8 CI 中的测试执行

### 测试矩阵

```yaml
# 在 GitHub Actions 中（详见 21-cicd-pipeline.md）

jobs:
  test:
    steps:
      - run: npm test              # 单元测试
      - run: npm run test:coverage # 覆盖率报告
      - run: npm run typecheck     # 类型检查

  integration:
    needs: test
    services:
      postgres:
        image: postgres:16
    steps:
      - run: npm run test:integration

  e2e:
    needs: integration
    steps:
      - run: npx playwright test
      - uses: actions/upload-artifact  # 失败截图
```

### 测试速度目标

| 类型 | 目标时间 | 说明 |
|------|---------|------|
| 单元测试（全量） | < 30s | 必须快，开发者频繁运行 |
| 集成测试（全量） | < 2min | CI 中运行 |
| E2E 测试（核心流程） | < 5min | CI 中运行 |
| 完整测试套件 | < 10min | PR 合并前 |

---

## 20.9 测试文化 & 规则

### 强制规则

```
1. 新功能必须附带测试
   → PR 中新增的逻辑代码必须有对应测试
   → Reviewer 有权拒绝无测试的 PR

2. Bug 修复必须附带回归测试
   → 先写测试复现 bug → 再修复 → 测试变绿
   → 防止同一个 bug 再次出现

3. 被锁定的模块修改前必须跑测试
   → 见 CLAUDE.md "已锁定模块" 列表
   → 修改前 npm test 通过 → 修改后 npm test 通过

4. CI 测试失败 = PR 不能合并
   → 不允许跳过失败的测试
   → 不允许注释掉失败的测试
```

### 不要做的事

```
❌ 为了覆盖率而写无意义的测试（只测 getter/setter）
❌ 测试实现细节（私有方法、内部状态）
❌ 写了测试但从不维护（过时的断言、注释掉的测试）
❌ E2E 测试依赖外部 API（必须 mock 或用测试环境）
❌ 测试之间有顺序依赖（每个测试必须独立可运行）
❌ 在测试中 sleep/setTimeout（用 waitFor/poll 代替固定等待）
```

---

## 20.10 Phase 规划

| 功能 | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|---------|
| Vitest 单元测试 | ✅ 已有 | ✅ 扩充 | ✅ | ✅ | ✅ |
| 覆盖率报告 | — | ✅ 配置 | ✅ | ✅ | ✅ |
| React Testing Library | — | ✅ | ✅ | ✅ | ✅ |
| supertest API 集成测试 | — | ✅ | ✅ | ✅ | ✅ |
| 测试数据库 + seed | — | ✅ | ✅ | ✅ | ✅ |
| CI 自动跑测试 | — | ✅ | ✅ | ✅ | ✅ |
| Playwright E2E | — | — | ✅ 核心流程 | ✅ | ✅ |
| k6 性能测试 | — | — | ✅ 手动 | ✅ CI | ✅ |
| OWASP ZAP 安全扫描 | — | — | — | ✅ | ✅ |
| 覆盖率 ≥ 75% | — | — | — | — | ✅ |
| 外部安全审计 | — | — | — | — | ✅ |
