# 04 — 平台钱包与双币策略

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 4.1 核心设计：统一平台钱包

```
用户的钱 → 只存在一个地方 → Bill.ai 平台钱包
应用（Rich Game 等）→ 不碰钱 → 只能通过 SDK 请求平台「帮我收 / 帮我付」
```

**类比微信模式**：
- 用户充值到微信钱包（一次）
- 小程序收费 → 微信弹出支付确认 → 微信扣款
- 小程序永远碰不到用户的钱
- Bill.ai 完全复制此模式

## 4.2 双币支持：法币 + 加密货币

平台钱包同时支持两种入金方式，内部统一为平台余额：

```
充值入口:

  🔗 加密货币（Phase 0 起即支持）
    ├── USDC / USDT
    ├── 6 条链：Ethereum / Polygon / BSC / Arbitrum / Base / Tron
    ├── HD 钱包系统（从 Rich Game 迁入，代码已就绪）
    └── 无需苹果审核，无抽成

  💳 法币（Phase 3 加入）
    ├── Stripe（Web 版，手续费 ~3%）
    ├── Apple IAP（iOS 版，佣金 15%）
    ├── Google Pay（Android 版）
    └── 需要 KYC + 支付牌照

平台内部:
  所有充值统一转换为 micro-USDC（1 USDC = 1,000,000 micro）
  应用通过 SDK 操作余额时，不知道钱的来源是法币还是加密货币

提现出口:
  → 提到加密钱包（USDC 出金，Phase 0 起支持）
  → 提到银行卡（法币出金，Phase 3 加入）
```

## 4.3 资金流向

```
┌──────────────────────────────────────────────────────┐
│                 Bill.ai 平台钱包                       │
│                                                      │
│  充值入口:                                             │
│    MetaMask ──USDC──→ 【user_balances 表】             │
│    Stripe ──$USD──→      (统一余额)                    │
│    Apple IAP ──$──→                                   │
│                          │                            │
│  应用扣费/发奖:           │                            │
│    SDK charge()  ←───────┤                            │
│    SDK reward()  ────────→                            │
│                          │                            │
│  提现出口:                │                            │
│    ← USDC ── 提到绑定的加密钱包                         │
│    ← $USD ── 提到银行卡（Phase 3）                      │
│                                                      │
│  平台抽成:                                             │
│    每笔 charge/reward 时自动计算平台服务费               │
│                                                      │
│  分润引擎:                                             │
│    每笔交易自动分账给 开发者/频道主/推广者               │
│    详见 06-roles-revenue.md                            │
└──────────────────────────────────────────────────────┘
```

## 4.4 苹果抽成策略

| 充值渠道 | 苹果抽成 | 用户实际到账 | 适用场景 |
|---------|---------|------------|---------|
| 加密货币（链上） | 0% | ~99.9% | Web + iOS + Android |
| Stripe（Web 版） | 0% | ~97% | Web 浏览器 |
| Apple IAP | **15%** | 85% | iOS App 内 |
| Google Pay | **15%** | 85% | Android App 内 |

**聪明做法**（业界标准）：
- iOS App 内：显示 Apple IAP 充值（苹果强制要求）
- 同时引导：「在 Web 版充值更划算」
- Web 版：显示 Stripe + 加密货币（无苹果抽成）
- 和 Discord / Spotify / Netflix 的做法一致

## 4.5 KYC 与合规

| 阶段 | 支持币种 | KYC 要求 | 牌照要求 |
|------|---------|---------|---------|
| **Phase 0-2** | 仅加密货币 | 可选（多数地区） | 不需要 |
| **Phase 3** | + 法币 | **必须** | **需要 MSB 牌照** |

**KYC 分级方案**：

```
Level 0（注册即可用）:
  ├── 无需任何验证
  ├── 限额：充值/提现 ≤ $100/天
  └── 仅支持加密货币

Level 1（基础验证）:
  ├── 邮箱 + 手机号验证
  ├── 限额：充值/提现 ≤ $1,000/天
  └── 支持加密货币 + 小额法币

Level 2（完整 KYC）:
  ├── 身份证/护照 + 人脸识别
  ├── 限额：充值/提现 ≤ $50,000/天
  └── 全部功能解锁
```

## 4.6 已有代码的迁移

Rich Game 已实现的钱包相关代码 **不需要重做**，整体搬到平台层：

| 现有代码 | 迁移目标 | 改动量 |
|---------|---------|--------|
| `backend/src/chain/hd-wallet.service.ts` | 平台后端 | 几乎不改 |
| `backend/src/chain/sweep.service.ts` | 平台后端 | 几乎不改 |
| `backend/src/balance/balance.service.ts` | 平台后端 | 微调接口 |
| `user_balances` 表 | 平台数据库（Supabase） | 表结构不变 |
| `balance_transactions` 表 | 平台数据库（Supabase） | 表结构不变 |
| `user_deposit_addresses` 表 | 平台数据库（Supabase） | 表结构不变 |
| 前端充值/提现 UI | 平台钱包页面 | 重新设计 UI |

Rich Game 应用侧的改动：

```
旧代码:
  // 直接操作 user_balances
  await BalanceDB.debit(userId, entryFee, 'game_entry');

新代码:
  // 通过 SDK 请求平台扣款（前端调用）
  await billai.wallet.charge({ amount: entryFee, reason: '游戏入场费' });

  // 或后端通过平台 API 扣款（服务端调用）
  await platformAPI.wallet.charge(userId, entryFee, 'game_entry');
```

## 4.7 分阶段实施

```
Phase 0-2（当前）:
  ✅ 加密货币充值/提现（HD 钱包系统搬到平台层）
  ✅ 平台统一余额
  ✅ SDK wallet.charge() / wallet.reward()
  ❌ 暂不做法币、KYC

Phase 3（用户量起来后）:
  + Stripe 法币充值（Web 版）
  + KYC Level 0 + Level 1
  + 注册 MSB 牌照（或找合规合作方）

Phase 4（上 App Store 后）:
  + Apple IAP 充值（iOS 版，苹果抽 15%）
  + Google Pay 充值（Android 版）
  + KYC Level 2
  + 定价策略：iOS 内充值标价高 15%，引导 Web 充值
```
