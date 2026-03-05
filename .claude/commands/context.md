加载项目完整上下文：读取架构文档、开发规范、最近变更，让本次对话快速进入状态。

请依次执行以下步骤：

1. **读取架构索引**
   读取 `docs/PLATFORM_ARCHITECTURE.md`，了解 Bill.ai 平台的整体架构和 22 篇文档目录。

2. **读取最近变更**
   读取 `HANDOFF.md`，了解最近完成的工作。

3. **按需加载架构文档**
   根据用户接下来要做的事情，主动读取相关的架构文档：
   - 如果用户要做平台核心 → 读取 `docs/architecture/01-platform-core.md`
   - 如果用户要做 SDK/沙盒 → 读取 `docs/architecture/02-app-runtime.md`
   - 如果用户要做后端 → 读取 `docs/architecture/03-backend.md` + `docs/architecture/12-tech-decisions.md`
   - 如果用户要做前端/UI → 读取 `docs/architecture/13-ui-design-system.md`
   - 如果用户要做钱包/支付 → 读取 `docs/architecture/04-wallet.md`
   - 如果用户要做合规/审核 → 读取 `docs/architecture/05-compliance.md`
   - 如果用户要做分润 → 读取 `docs/architecture/06-roles-revenue.md`
   - 如果用户要做订阅 → 读取 `docs/architecture/07-subscription.md`
   - 如果用户要做推广 → 读取 `docs/architecture/08-promotion.md`
   - 如果用户要做存储 → 读取 `docs/architecture/09-storage.md`
   - 如果用户要做 Rich Game 迁入 → 读取 `docs/architecture/10-rich-game-migration.md`
   - 如果用户要做路线图 → 读取 `docs/architecture/11-roadmap.md`
   - 如果用户要做评分 → 读取 `docs/architecture/14-rating-system.md`
   - 如果用户要做后台管理 → 读取 `docs/architecture/15-admin-panels.md`
   - 如果用户要做 AI 工厂 → 读取 `docs/architecture/16-ai-app-factory.md`
   - 如果用户要做通知/搜索/i18n → 读取 `docs/architecture/17-notification-search-i18n.md`
   - 如果用户要做安全 → 读取 `docs/architecture/18-security-ops.md`
   - 如果用户要做无障碍 → 读取 `docs/architecture/19-accessibility.md`
   - 如果用户要做测试 → 读取 `docs/architecture/20-testing-strategy.md`
   - 如果用户要做 CI/CD → 读取 `docs/architecture/21-cicd-pipeline.md`
   - 如果用户要做移动端适配 → 读取 `docs/architecture/22-mobile-design.md`
   - 如果不确定用户要做什么，先不读具体文档，等用户说明后再读

4. **汇报当前状态**
   用简洁的格式告诉用户：

   ```
   ✅ 项目上下文已加载

   📐 架构文档: 22 篇（v2.4）
   📝 最近变更: （从 HANDOFF.md 摘要最近 3 条）
   🔧 可用命令: /context /status /dev-check /finish /services

   请告诉我接下来要做什么，我会加载对应的详细文档。
   ```

5. **等待用户指令**
   不要主动开始做任何开发工作，等用户说明接下来的任务。
