# 03 — 后端架构（混合模式）

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 3.1 架构决策

```
Bill.ai 平台层 → Supabase（精装房，快速开发）
  ├── Supabase Auth      → 用户认证（邮箱/Google/Apple 登录）
  ├── Supabase Database  → 用户、社交、聊天、应用商店等表
  ├── Supabase Realtime  → WebSocket 实时推送
  ├── Supabase Storage   → 小文件存储（头像、图片）
  └── Edge Functions     → 轻量后端逻辑

Rich Game 应用层 → Express 自建（毛坯房，完全自由）
  ├── Express Server     → 游戏逻辑、回合制系统
  ├── WebSocket Server   → 游戏内实时交互
  ├── PostgreSQL         → 游戏数据（rooms、rounds、votes）
  └── 链上交互           → 钱包、USDC 合约

AI 生成的简单应用 → Supabase（精装房）
  └── 简单 CRUD 应用直接使用 Supabase，无需独立后端

大文件存储 → Cloudflare R2（独立存储服务）
  └── 视频、大型媒体文件（详见 09-storage.md）
```

## 3.2 平台与应用后端的交互

```
用户浏览器
  ├── Bill.ai 平台前端
  │     ├── 直接调用 Supabase（用户数据、社交、聊天）
  │     └── 管理 iframe 中的应用
  │
  └── Rich Game iframe（应用前端）
        ├── 通过 App SDK ← postMessage → 平台前端 → Supabase
        │   （用户信息、钱包、社交等平台能力）
        │
        └── 直接调用 Rich Game Express 后端
            （游戏逻辑、WebSocket、游戏数据）
            后端通过平台签发的 App Token 验证用户身份
```

## 3.3 认证架构

### 登录方式（平台层，Supabase Auth）

```
注册/登录:
  ├── 邮箱 + 密码            ← 基础方式
  ├── Google 一键登录         ← OAuth
  ├── Apple 一键登录          ← 苹果审核必须有（如果提供第三方登录）
  └── 手机号 OTP（可选）      ← Phase 3

钱包不再是登录方式，而是用户设置:
  ├── 设置 → 钱包管理 → 绑定 EVM 钱包（MetaMask 签名验证）
  ├── 设置 → 钱包管理 → 绑定 Tron 钱包（TronLink 签名验证）
  ├── 可以绑定多个钱包
  ├── 设置默认提现钱包
  └── 没绑钱包也能用平台（法币充值 / 免费应用）
```

### 认证流转

```
1. 用户在 Bill.ai 登录（Supabase Auth）→ 获得 Platform Token
2. 用户打开 Rich Game → 平台为 Rich Game 签发 App Token
   App Token 包含: { userId, appId, permissions, exp }
3. Rich Game 前端拿到 App Token
4. Rich Game 前端调用 Express 后端时带上 App Token
5. Express 后端验证 App Token（用平台的公钥验签）
6. 验证通过 → 识别用户身份 → 执行游戏逻辑
```

### App Token 验证代码

```typescript
// Rich Game 后端: 验证平台签发的 App Token
import jwt from 'jsonwebtoken';

export function verifyAppToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'NO_TOKEN' });

  try {
    // 用平台公钥验证
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

## 3.4 用户绑定钱包的数据模型

```sql
-- 用户绑定的钱包地址（可以绑定多个）
CREATE TABLE user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  chain_type TEXT NOT NULL,             -- 'evm' | 'tron'
  address TEXT NOT NULL,                -- 钱包地址
  label TEXT,                           -- 用户给钱包起的名字
  is_default BOOLEAN DEFAULT false,     -- 是否默认提现地址
  verified_at TIMESTAMPTZ NOT NULL,     -- 签名验证时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, address)
);
```

### 绑定流程

```
用户点击「绑定 EVM 钱包」
  → 调用 MetaMask 签名一条消息: "Link wallet to Bill.ai account {userId} at {timestamp}"
  → 前端发送 { address, signature, message } 到后端
  → 后端验证签名 → 确认地址属于该用户
  → 写入 user_wallets 表
  → 绑定成功

提现时:
  → 用户选择绑定的钱包地址
  → 平台从 HD 热钱包发送 USDC 到用户地址
```
