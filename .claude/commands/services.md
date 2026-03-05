项目服务商与第三方依赖速查：列出当前项目用到的所有服务商、云服务、第三方库和外部 API。

---

## 云服务 & 基础设施

| 服务 | 用途 | 状态 | 环境变量 |
|------|------|------|---------|
| **Supabase** | Auth + DB + Realtime + Storage + Edge Functions | ✅ 使用中 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| **Cloudflare R2** | 大文件存储 + CDN | 📋 规划中 | — |
| **Railway** | 应用后端部署（Rich Game 等） | 📋 规划中 | — |
| **Resend** | 邮件发送 | 📋 规划中 | — |
| **Sentry** | 错误追踪 | 📋 规划中 | — |

## 前端依赖

| 库 | 用途 | 版本 |
|----|------|------|
| React | UI 框架 | 18.3.x |
| Vite | 构建工具 | 5.x |
| TypeScript | 类型系统 | 5.8.x |
| Tailwind CSS | 样式 | 3.4.x |
| shadcn/ui (Radix) | UI 组件库 | — |
| React Router | 路由 | 6.x |
| TanStack React Query | 数据请求 + 缓存 | 5.x |
| React Hook Form + Zod | 表单验证 | — |
| Sonner | Toast 通知 | 1.7.x |
| Lucide React | 图标 | — |
| next-themes | 主题切换 | 0.3.x |
| Recharts | 图表 | 2.x |

## 环境变量速查

```bash
# Supabase（必须）
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...

# 后续会新增
# VITE_SENTRY_DSN=
# VITE_R2_PUBLIC_URL=
```
