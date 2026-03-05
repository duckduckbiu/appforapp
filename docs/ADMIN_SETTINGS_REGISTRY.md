# Bill.ai — 后台可配置项注册表

> 开发时识别"可配置项"，记录到此文档。将来做管理面板时直接按表开发。
>
> **开发规则**：每完成一个功能，检查有哪些硬编码值应该后台可配，录入此表。

---

## 配置来源说明

| 来源 | 说明 |
|------|------|
| **自有后台** | 存储在 `platform_settings` 表，我们的管理面板可直接读写 |
| **Supabase API** | 通过 Supabase Management API 配置，可封装进我们的管理面板 |
| **外部平台** | 必须在第三方平台操作（Google Cloud Console、Apple Developer 等），一次性配置后将凭证填入我们的后台 |

---

## 1. 认证与登录

| 设置项 | 当前默认值 | 类型 | 配置来源 | 硬编码位置 | 备注 |
|--------|-----------|------|---------|-----------|------|
| 重新发送验证邮件冷却时间 | 60s | number | 自有后台 | `Auth.tsx` | — |
| 密码最低长度 | 6 | number | Supabase API | `Auth.tsx` (前端校验) + Supabase (后端校验) | 前后端需同步 |
| 是否启用邮箱确认 | true | boolean | Supabase API | Supabase Dashboard | — |
| 是否启用 Google OAuth | false（需配置） | boolean | Supabase API | Supabase Dashboard | 上线前配置。需先在 Google Cloud Console 创建 OAuth Client ID + Secret，填入后台 |
| Google OAuth Client ID | — | string | Supabase API | Supabase Dashboard | 从 Google Cloud Console 获取 |
| Google OAuth Client Secret | — | secret | Supabase API | Supabase Dashboard | 从 Google Cloud Console 获取 |
| 是否启用 Apple OAuth | false（需配置） | boolean | Supabase API | Supabase Dashboard | 上线前配置。需先在 Apple Developer 创建 Service ID + Key，填入后台 |
| Apple Service ID | — | string | Supabase API | Supabase Dashboard | 从 Apple Developer 获取 |
| Apple Team ID | — | string | Supabase API | Supabase Dashboard | 从 Apple Developer 获取 |
| Apple Private Key | — | secret | Supabase API | Supabase Dashboard | 从 Apple Developer 获取 |
| 是否屏蔽常见密码 | true | boolean | Supabase API | Supabase Dashboard | — |
| 登录失败锁定阈值 | 未设置 | number | 自有后台 | 待实现 | — |
| JWT 过期时间（用户） | 7 天 | duration | Supabase API | Supabase Dashboard | — |
| JWT 过期时间（管理员） | 8 小时 | duration | Supabase API | Supabase Dashboard | — |
| OAuth Redirect URL | `window.location.origin` | string | 自有后台 | `Auth.tsx` | — |

---

## 2. 应用商店

| 设置项 | 当前默认值 | 类型 | 配置来源 | 硬编码位置 | 备注 |
|--------|-----------|------|---------|-----------|------|
| 应用默认状态 | draft | enum | 自有后台 | `migrations/phase1_apps.sql` | draft→pending→approved→rejected |
| 应用默认年龄分级 | all | enum | 自有后台 | `migrations/phase1_apps.sql` | all/13+/17+/18+ |
| App Token 有效期 | 3600s（1h） | number | 自有后台 | `functions/issue-app-token/index.ts:101` | 签发的 JWT exp 偏移量 |
| App Store 应用列表排序 | install_count DESC | enum | 自有后台 | `hooks/useApps.ts` | 可改为 created_at / rating |

---

## 3. 用户封禁系统

| 设置项 | 当前默认值 | 类型 | 配置来源 | 硬编码位置 | 备注 |
|--------|-----------|------|---------|-----------|------|
| 封禁时长选项 | 7天/30天/永久 | enum[] | 自有后台 | `Admin.tsx` BanManagement | 管理员封禁用户时的时长选项 |

---

## 4. 年龄分级

| 设置项 | 当前默认值 | 类型 | 配置来源 | 硬编码位置 | 备注 |
|--------|-----------|------|---------|-----------|------|
| 年龄分级枚举值 | all/13+/17+/18+ | enum[] | 自有后台 | `apps.age_rating`、`AgeGate.tsx` | 上线前确认合规要求 |
| AgeGate 确认有效期 | 永久（localStorage）| — | 自有后台 | `AgeGate.tsx` | 可改为按 session 或按天重置 |

---

## 5. 频道系统

| 设置项 | 当前默认值 | 类型 | 配置来源 | 硬编码位置 | 备注 |
|--------|-----------|------|---------|-----------|------|
| 频道默认可见性 | public | boolean | 自有后台 | `migrations/phase1_channels.sql` | true = 公开可浏览 |
| 频道列表排序 | member_count DESC | enum | 自有后台 | `hooks/useChannels.ts` | 可改为 created_at |

---

<!-- 后续功能模块的可配置项追加到这里 -->
