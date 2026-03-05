# 02 — App SDK · 沙盒 · 应用清单

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 2.1 App SDK 接口规范

> 这是整个平台的「宪法」。所有应用（包括 AI 生成的应用）都必须通过 SDK 与平台交互。

### SDK 初始化

```typescript
// 应用入口文件
import { BillaiSDK } from '@billai/app-sdk';

const billai = new BillaiSDK({
  appId: 'rich-game',           // 应用唯一标识
  version: '1.0.0',             // 应用版本
  permissions: [                 // 声明所需权限
    'wallet.read',
    'wallet.charge',
    'user.profile.read',
    'notification.send',
  ],
});

// SDK 就绪后执行应用逻辑
billai.ready().then(() => {
  console.log('App SDK 已连接平台');
  startApp();
});
```

### 用户模块 (billai.user)

```typescript
interface UserModule {
  /** 获取当前登录用户基本信息 */
  getProfile(): Promise<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
    username: string;
  }>;

  /** 获取指定用户的公开资料 */
  getPublicProfile(userId: string): Promise<PublicProfile>;

  /** 监听用户登录/登出事件 */
  onAuthChange(callback: (user: UserProfile | null) => void): Unsubscribe;
}
```

**使用示例**：
```typescript
const user = await billai.user.getProfile();
console.log(`当前用户: ${user.displayName}`);
```

### 钱包模块 (billai.wallet)

```typescript
interface WalletModule {
  /** 查询用户在平台的余额（返回 micro-USDC） */
  getBalance(): Promise<{ balance: number; currency: string }>;

  /** 向用户收费（需要 wallet.charge 权限）
   *  平台会弹出确认对话框，用户确认后扣款
   *  @returns transactionId 成功时返回交易ID
   */
  charge(params: {
    amount: number;           // micro-USDC
    reason: string;           // 显示给用户的扣款原因
    metadata?: Record<string, any>;
  }): Promise<{ transactionId: string }>;

  /** 向用户发放奖励（需要 wallet.reward 权限）
   *  从应用的资金池中转入用户钱包
   */
  reward(params: {
    amount: number;
    reason: string;
    metadata?: Record<string, any>;
  }): Promise<{ transactionId: string }>;

  /** 监听余额变化 */
  onBalanceChange(callback: (balance: number) => void): Unsubscribe;
}
```

**使用示例**：
```typescript
// Rich Game: 用户加入游戏时收取入场费
try {
  const { transactionId } = await billai.wallet.charge({
    amount: 5_000_000,  // 5 USDC
    reason: '加入 Rich Game 房间 #game_5usdc_abc',
    metadata: { gameId: 'game_5usdc_abc', type: 'entry_fee' },
  });
  // 扣款成功，让用户进入游戏
  joinGame(transactionId);
} catch (e) {
  if (e.code === 'USER_CANCELLED') {
    // 用户取消了付款
  } else if (e.code === 'INSUFFICIENT_BALANCE') {
    // 余额不足
  }
}
```

### 社交模块 (billai.social)

```typescript
interface SocialModule {
  /** 分享内容到 Feed */
  shareToFeed(params: {
    text: string;
    images?: string[];        // 图片 URL
    link?: string;            // 外链
    visibility?: 'public' | 'followers' | 'friends' | 'private';
  }): Promise<{ postId: string }>;

  /** 获取当前用户的好友列表 */
  getFriends(params?: {
    limit?: number;
    offset?: number;
  }): Promise<Friend[]>;

  /** 邀请好友使用应用 */
  inviteFriends(params: {
    message: string;
    deepLink?: string;        // 应用内深链接
  }): Promise<{ invitedCount: number }>;
}
```

### 聊天模块 (billai.chat)

```typescript
interface ChatModule {
  /** 向指定用户发送消息（以应用身份） */
  sendMessage(params: {
    toUserId: string;
    content: string;
    type?: 'text' | 'image' | 'rich_card';
  }): Promise<{ messageId: string }>;

  /** 监听来自用户的消息（用户在应用内发消息时） */
  onMessage(callback: (message: ChatMessage) => void): Unsubscribe;
}
```

### 通知模块 (billai.notification)

```typescript
interface NotificationModule {
  /** 发送灵动岛通知 */
  sendIslandNotification(params: {
    title: string;
    message: string;
    icon?: string;
    actions?: Array<{
      label: string;
      action: string;         // 应用内事件名
    }>;
    priority?: 'low' | 'normal' | 'high';
    duration?: number;        // 毫秒，默认 6000
  }): Promise<void>;

  /** 发送系统推送 */
  sendPush(params: {
    title: string;
    body: string;
    data?: Record<string, any>;
  }): Promise<void>;
}
```

### 权限模块 (billai.permission)

```typescript
interface PermissionModule {
  /** 检查是否已获得某权限 */
  check(permission: string): Promise<boolean>;

  /** 请求权限（平台弹出授权对话框） */
  request(permission: string, reason: string): Promise<boolean>;

  /** 监听权限变化 */
  onChange(callback: (permission: string, granted: boolean) => void): Unsubscribe;
}
```

### UI 模块 (billai.ui)

```typescript
interface UIModule {
  /** 显示 toast 消息 */
  showToast(params: {
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    duration?: number;
  }): void;

  /** 显示确认对话框（由平台渲染，不在 iframe 内） */
  confirm(params: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }): Promise<boolean>;

  /** 获取平台主题色 */
  getTheme(): Promise<{ mode: 'light' | 'dark'; primaryColor: string }>;

  /** 监听主题变化 */
  onThemeChange(callback: (theme: Theme) => void): Unsubscribe;

  /** 设置应用在平台中的标题 */
  setTitle(title: string): void;

  /** 设置加载状态（平台顶部显示进度条） */
  setLoading(loading: boolean): void;
}
```

### 订阅模块 (billai.subscription)

> 详见 [07-subscription.md](./07-subscription.md)

```typescript
interface SubscriptionModule {
  /** 检查用户是否有有效订阅 */
  check(planId?: string): Promise<{ active: boolean; plan?: SubscriptionPlan; expiresAt?: string }>;

  /** 发起订阅购买（平台弹出订阅页面） */
  subscribe(params: {
    planId: string;
    period: 'monthly' | 'yearly';
  }): Promise<{ subscriptionId: string }>;

  /** 监听订阅状态变化 */
  onStatusChange(callback: (status: SubscriptionStatus) => void): Unsubscribe;
}
```

### 存储模块 (billai.storage)

> 详见 [09-storage.md](./09-storage.md)

```typescript
interface StorageModule {
  /** 读取应用专属的持久化数据（每用户独立） */
  get(key: string): Promise<any>;

  /** 写入应用专属数据 */
  set(key: string, value: any): Promise<void>;

  /** 删除数据 */
  remove(key: string): Promise<void>;

  /** 上传文件到平台存储 */
  uploadFile(params: {
    file: File;
    path: string;
    preset?: 'avatar' | 'post' | 'message' | 'video';
  }): Promise<{ url: string; fileId: string }>;

  /** 获取存储用量 */
  getUsage(): Promise<{ used: number; quota: number }>;
}
```

### 事件模块 (billai.events)

```typescript
interface EventsModule {
  /** 监听平台级事件 */
  on(event: PlatformEvent, callback: Function): Unsubscribe;

  /** 向平台发送事件 */
  emit(event: string, data: any): void;
}

type PlatformEvent =
  | 'user:login'          // 用户登录
  | 'user:logout'         // 用户登出
  | 'app:foreground'      // 应用被切到前台
  | 'app:background'      // 应用被切到后台
  | 'theme:change'        // 主题切换
  | 'language:change'     // 语言切换
  | 'network:change';     // 网络状态变化
```

---

## 2.2 沙盒机制

### iframe 沙盒

```
┌─ Bill.ai 平台 (Host) ────────────────────────────┐
│                                                    │
│  ┌─ 顶栏 (z-index: 50) ───────────────────────┐  │
│  │  Bill.ai  [<] [>] [搜索/灵动岛] [🌙] [👤]   │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─ 侧栏 ─┐  ┌─ iframe 沙盒 ──────────────────┐  │
│  │  🏠 首页 │  │                                │  │
│  │  💬 聊天 │  │   应用前端代码在此运行           │  │
│  │  📺 频道 │  │                                │  │
│  │  🏪 商店 │  │   sandbox="allow-scripts        │  │
│  │  ⚙️ 设置 │  │            allow-same-origin"   │  │
│  │         │  │                                │  │
│  │         │  │   ← postMessage 通信 →          │  │
│  │         │  │                                │  │
│  └─────────┘  └────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 通信协议 (postMessage)

所有 SDK 调用底层走 `postMessage`：

```typescript
// ═══ 请求格式（App → Platform）═══
interface SDKRequest {
  type: 'BILLAI_SDK_REQUEST';
  id: string;                    // 请求唯一 ID（用于匹配响应）
  appId: string;                 // 应用标识
  module: string;                // SDK 模块名（如 'wallet'）
  method: string;                // 方法名（如 'charge'）
  params: any;                   // 参数
  timestamp: number;
}

// ═══ 响应格式（Platform → App）═══
interface SDKResponse {
  type: 'BILLAI_SDK_RESPONSE';
  id: string;                    // 对应请求的 ID
  success: boolean;
  data?: any;                    // 成功时的返回数据
  error?: {                      // 失败时的错误信息
    code: string;
    message: string;
  };
}

// ═══ 事件推送（Platform → App）═══
interface SDKEvent {
  type: 'BILLAI_SDK_EVENT';
  appId: string;
  event: string;                 // 事件名
  data: any;                     // 事件数据
}
```

**示例：应用调用 `billai.wallet.charge()`**

```
App iframe                          Platform Host
    |                                    |
    |  postMessage({                     |
    |    type: 'BILLAI_SDK_REQUEST',     |
    |    id: 'req_001',                  |
    |    module: 'wallet',               |
    |    method: 'charge',               |
    |    params: { amount: 5000000,      |
    |              reason: '入场费' }      |
    |  })                                |
    |  ─────────────────────────────►    |
    |                                    |  1. 验证 appId + 权限
    |                                    |  2. 弹出确认对话框
    |                                    |  3. 用户点击「确认」
    |                                    |  4. 调用 Supabase 扣款
    |                                    |
    |    postMessage({                   |
    |      type: 'BILLAI_SDK_RESPONSE',  |
    |      id: 'req_001',               |
    |      success: true,                |
    |      data: { transactionId: '...'} |
    |    })                              |
    |  ◄─────────────────────────────    |
    |                                    |
```

### 安全边界

| 应用能做 | 应用不能做 |
|---------|-----------|
| 渲染自己的 UI | 访问平台 DOM |
| 调用 SDK 方法 | 直接读写 Supabase |
| 使用自己的后端 API | 读取平台 Cookie / localStorage |
| 存储应用数据（通过 SDK） | 修改浏览器 URL |
| 发送通知（需权限） | 弹出全屏覆盖物 |
| 请求用户付费（平台弹窗） | 直接扣款 |

### 应用加载流程

```
1. 用户在应用商店点击「打开 Rich Game」
2. 平台创建 iframe，src 指向应用入口 URL
3. iframe 加载应用前端代码
4. 应用初始化 SDK → billai.ready()
5. SDK 通过 postMessage 向平台握手
6. 平台验证 appId → 返回用户 token + 主题等信息
7. 应用拿到用户身份，开始正常运行
8. 应用通过 SDK 调用平台能力（钱包、社交等）
```

---

## 2.3 应用清单 (App Manifest)

每个应用必须声明一个 `billai.manifest.json`：

```json
{
  "appId": "rich-game",
  "name": "Rich Game",
  "version": "1.0.0",
  "description": "区块链策略淘汰游戏",
  "developer": {
    "name": "Rich Game Studio",
    "email": "dev@richgame.io",
    "website": "https://richgame.io"
  },
  "entry": "https://rich-game-app.example.com/",
  "icon": "https://cdn.example.com/rich-game-icon.png",
  "screenshots": [
    "https://cdn.example.com/screenshot1.png"
  ],
  "category": "games",
  "ageRating": "17+",
  "ageRatingReasons": [
    "simulated-gambling",
    "real-money-transactions"
  ],
  "ageGate": true,
  "permissions": [
    {
      "id": "wallet.read",
      "reason": "查看您的余额以确认可以参与游戏"
    },
    {
      "id": "wallet.charge",
      "reason": "收取游戏入场费"
    },
    {
      "id": "wallet.reward",
      "reason": "向获胜者发放奖励"
    },
    {
      "id": "user.profile.read",
      "reason": "在游戏内显示您的头像和昵称"
    },
    {
      "id": "notification.island",
      "reason": "通知您游戏状态变化（轮次开始、投票等）"
    },
    {
      "id": "social.share",
      "reason": "将游戏结果分享到动态"
    }
  ],
  "revenue": {
    "platformFee": 500,
    "developerShare": 7000,
    "channelShare": 1500,
    "promoterShare": 500,
    "appReserve": 500
  },
  "regionRestrictions": {
    "mode": "blocklist",
    "regions": ["CN", "US-NV", "US-NJ"],
    "message": {
      "zh": "此应用在您所在地区暂不可用",
      "en": "This app is not available in your region"
    }
  },
  "backend": {
    "type": "external",
    "url": "https://rich-game-api.example.com",
    "healthCheck": "/health"
  },
  "sandbox": {
    "allowPopups": false,
    "allowForms": true,
    "allowModals": false
  },
  "i18n": {
    "defaultLocale": "zh",
    "supportedLocales": ["zh", "en"]
  }
}
```
