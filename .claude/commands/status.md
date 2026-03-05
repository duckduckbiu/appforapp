项目状态检查：快速了解当前项目的健康状态。

请执行以下检查并汇总报告：

1. **Git 状态** — `git status`（当前分支、未提交变更）
2. **依赖检查** — `cd "/Users/dzfk/Desktop/App for app/platform" && npm ls --depth=0 2>&1 | tail -5`
3. **类型检查** — `cd "/Users/dzfk/Desktop/App for app/platform" && npx tsc --noEmit 2>&1 | tail -3`
4. **构建状态** — `cd "/Users/dzfk/Desktop/App for app/platform" && npm run build 2>&1 | tail -5`
5. **Supabase 状态** — 检查 `platform/supabase/config.toml` 是否存在
6. **最近变更** — `git log --oneline -5`

汇总格式：
```
📊 App for app 项目状态

🌿 分支: main
📦 依赖: ✅/❌
🔷 TypeScript: ✅/❌ (X errors)
🏗️ 构建: ✅/❌
🗄️ Supabase: ✅/❌

最近 5 次提交:
  ...
```
