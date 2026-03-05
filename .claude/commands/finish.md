完成功能：执行完整的收尾流程。

请依次执行以下步骤：

1. **类型检查** — `cd "/Users/dzfk/Desktop/App for app/platform" && npx tsc --noEmit`（必须通过）
2. **Lint** — `cd "/Users/dzfk/Desktop/App for app/platform" && npx eslint src/`
3. **构建验证** — `cd "/Users/dzfk/Desktop/App for app/platform" && npm run build`
4. **自测** — 确认功能正常工作（能跑 preview 就跑 preview）
5. **更新 HANDOFF.md** — 在「最近完成的工作」区块追加本次变更摘要：
   - 做了什么（一句话）
   - 涉及哪些文件（列出新建和修改的文件）
   - 如有新 API 或新路由，列出详情
   - 如有 DB 变更，列出新增/修改的表
6. **更新 memory 文件**（如果涉及架构级变更）
7. **更新服务清单**（如果引入了新的第三方服务/库/API）→ 更新 `.claude/commands/services.md`
8. **不要自动 commit/push** — 除非用户明确要求
