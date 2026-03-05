# 10 — Rich Game 改造方案

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 10.1 改动范围评估

| 模块 | 改动程度 | 说明 |
|------|---------|------|
| 游戏核心逻辑 | ❌ 不动 | 回合制、投票、淘汰、奖池分配 |
| Express 后端 | 🔧 微调 | Token 验证改为 App Token |
| WebSocket | ❌ 不动 | 游戏内实时交互保持不变 |
| 游戏数据库 | ❌ 不动 | games/rounds/players/votes 表不变 |
| 前端认证 | ✂️ 删除 | 去掉 AuthContext.tsx，改用 SDK |
| 前端钱包 UI | ✂️ 删除 | 去掉 WalletPage，改用 `billai.wallet` |
| 前端 Navbar | ✂️ 简化 | 去掉平台级导航，保留游戏内导航 |
| 前端入口 | 🔧 改造 | 添加 SDK 初始化逻辑 |
| Admin 面板 | 🤔 待定 | 可独立保留，或迁入平台管理 |

## 10.2 具体改造步骤

### 步骤 1：前端 — 接入 App SDK

```typescript
// Rich Game 新入口 main.tsx
import { BillaiSDK } from '@billai/app-sdk';

const billai = new BillaiSDK({
  appId: 'rich-game',
  version: '1.0.0',
  permissions: ['wallet.read', 'wallet.charge', 'wallet.reward', 'user.profile.read'],
});

billai.ready().then(async () => {
  const user = await billai.user.getProfile();
  renderApp(user, billai);
});
```

### 步骤 2：前端 — 替换认证

```
删除:
  - src/hooks/AuthContext.tsx          （整个文件）
  - src/lib/web3modal.ts              （钱包连接配置）
  - wagmi / @reown/appkit 依赖

替换为:
  - billai.user.getProfile()           → 获取用户信息
  - billai.user.onAuthChange()         → 监听登录状态
  - App Token                          → 发送给 Express 后端
```

### 步骤 3：前端 — 替换钱包

```
删除:
  - src/pages/WalletPage.tsx           （整个页面）
  - 充值/提现相关组件

替换为:
  - billai.wallet.getBalance()         → 查询余额
  - billai.wallet.charge()             → 游戏入场扣费
  - billai.wallet.reward()             → 游戏奖励发放
```

### 步骤 4：后端 — Token 验证

```typescript
// 新代码：验证平台签发的 App Token
import { verifyAppToken } from './auth/platform-token.js';

// platform-token.ts
export function verifyAppToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'NO_TOKEN' });

  try {
    const payload = jwt.verify(token, PLATFORM_PUBLIC_KEY);
    req.userId = payload.userId;
    req.appId = payload.appId;
    req.permissions = payload.permissions;
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}
```

### 步骤 5：保留独立运行能力

Rich Game 应该既能作为 Bill.ai 插件运行，也能独立运行（开发/测试用）：

```typescript
// 检测是否在 Bill.ai 平台内
const isInPlatform = window.parent !== window; // iframe 内

if (isInPlatform) {
  // 平台模式：使用 App SDK
  const billai = new BillaiSDK({ appId: 'rich-game' });
  await billai.ready();
} else {
  // 独立模式：使用原有认证（开发环境）
  // 保留 AuthContext 作为 fallback
}
```

## 10.3 Rich Game 保留的数据库表

所有现有的游戏表保持不变：
- `games`, `rounds`, `players`, `votes`
- `chat_messages`, `world_chat`
- `action_logs`

变更：
- `users` 表简化（不再存储认证信息，只存平台 userId 映射）
- `user_balances` 表移至平台层（通过 SDK 操作）
- `balance_transactions` 表移至平台层
