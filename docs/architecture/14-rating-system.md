# 14 — 应用评分与评价系统

> 本文件属于 [Bill.ai 平台架构设计文档](../PLATFORM_ARCHITECTURE.md) 的一部分。

---

## 14.1 为什么需要评分系统

| 角色 | 价值 |
|------|------|
| **用户** | 降低试错成本——"这个应用值不值得装？" |
| **开发者** | 获得真实反馈，定位需要改进的方向 |
| **平台** | 质量信号——排序、推荐、审核的核心数据源 |
| **频道主** | 选择安装哪些应用到自己频道时的参考依据 |

所有成功的应用平台（App Store、Google Play、Steam、微信小程序）都有评分系统。
Bill.ai 作为应用工厂，评分系统是应用商店的**核心基础设施**。

---

## 14.2 评分模型

### 基础评分

- **评分范围**: 1-5 星（整数），与 App Store / Google Play 一致
- **评论**: 可选文字评论，最长 2000 字符
- **限制**: 每用户每应用**只能评一次**，可以修改

### 评分门槛（防刷分）

不允许刚安装就评分，必须满足以下**全部条件**：

| 条件 | 阈值 | 说明 |
|------|------|------|
| 最低使用时长 | ≥ 5 分钟 | SDK 上报累计使用时长 |
| 安装后最低天数 | ≥ 1 天 | 防止批量注册刷分 |
| 账号状态 | 无活跃封禁 | 被封禁用户不能评分 |

### 信誉加权

低信誉账号的评分**不计入**公开平均分：

```
if (user.trust_score < 20) {
  review.weight = 0;        // 不计入平均分
  review.status = 'hidden';  // 不公开显示
}
```

---

## 14.3 评分展示算法

### 贝叶斯加权平均（Bayesian Weighted Average）

不用简单算术平均。与 IMDB、Steam 相同的算法：

```
weighted_score = (v × R + m × C) / (v + m)

v = 该应用的有效评分人数
R = 该应用的实际平均分
m = 最低评分人数阈值（平台参数，建议初始值 = 10）
C = 全平台所有应用的平均分（定期计算，比如每小时一次）
```

**效果**：
- 新应用只有 2 个五星评价 → 不会排第一（被 C 拉向平均）
- 老应用 1000+ 评价 → 几乎等于真实平均分（m 的影响可忽略）
- 避免"1 个差评毁掉新应用"的问题

### 评分趋势

除了总分，还展示**近 30 天趋势**：

```
recent_avg = AVG(rating) WHERE created_at > NOW() - INTERVAL '30 days'
trend = recent_avg - all_time_avg

显示: ↑ 上升中 / → 稳定 / ↓ 下降中
```

用户可以看到应用是在变好还是变差。

---

## 14.4 评分分布展示

像 App Store 一样展示分布条形图：

```
★★★★★  ████████████████████  68%
★★★★☆  ██████               20%
★★★☆☆  ██                    7%
★★☆☆☆  █                     3%
★☆☆☆☆  █                     2%

4.5  (1,234 条评价)
```

这比单独一个数字更有参考价值——用户能看到评分是集中在高分还是两极分化。

---

## 14.5 评论系统

### 评论展示排序

默认按**有用度**排序（不是时间）：

```
排序分 = helpful_count × 0.6 + recency_score × 0.3 + length_score × 0.1

recency_score = 1 / (1 + days_since_posted / 30)
length_score  = min(char_count / 200, 1)  // 鼓励有内容的评论
```

用户可以切换排序方式：最有用 / 最新 / 最高分 / 最低分

### "有用" 投票

每条评论有"有用"按钮（类似 Steam 的 thumbs up）：
- 每用户对每条评论只能投一次
- 高有用度的评论排在前面

### 开发者回复

- 开发者可以**回复**每条评论（每条评论只能回复一次）
- 回复显示在评论下方，带"开发者"标签
- 开发者**不能删除**用户评论（只有平台可以）
- 开发者可以**举报**不当评论

### 评论审核

评论是 UGC 内容，接入平台内容审核管道（见 [05-compliance.md](./05-compliance.md)）：

```
评论提交 → 关键词过滤 → AI 文本检测 → [通过] → 发布
                                      → [可疑] → 进入审核队列
                                      → [违规] → 自动隐藏 + 通知用户
```

---

## 14.6 防刷策略

### 刷好评

| 手段 | 防御 |
|------|------|
| 批量注册刷分 | 评分门槛（使用时长 + 安装天数）|
| 同一 IP 大量评分 | 同 IP 24h 内最多 3 条评分 |
| 开发者自评 | 开发者不能评自己的应用 |
| 激励好评 | 检测"给五星送金币"类应用内引导，违规下架 |
| 信誉低的账号 | trust_score < 20 的评分不计入 |

### 刷差评（恶意竞争）

| 手段 | 防御 |
|------|------|
| 竞品恶意差评 | 异常检测：短时间大量 1 星 → 触发人工审核 |
| 差评轰炸 | 评分门槛 + 贝叶斯加权（少量差评影响有限） |
| 开发者申诉 | 开发者可以申诉异常评分，平台人工审核 |

### 异常检测规则

```
// 短时间大量同分评分 → 标记为可疑
if (count_reviews_last_24h(app_id) > 50
    && stddev(ratings_last_24h) < 0.5) {
  flag_for_review(app_id, 'suspicious_rating_pattern');
}

// 新注册用户集中评同一个应用 → 可疑
if (count_new_user_reviews(app_id, days=7) > 20
    && avg_account_age < 3_days) {
  flag_for_review(app_id, 'new_account_rating_burst');
}
```

---

## 14.7 评分对商店排序的影响

应用商店"热门"排序的综合打分：

| 信号 | 权重 | 计算方式 |
|------|------|---------|
| **加权评分** | 30% | 贝叶斯加权平均（§14.3） |
| **安装量** | 25% | `log10(install_count + 1)` 归一化 |
| **近期活跃度** | 20% | 7 天活跃用户 / 总安装量 |
| **评分趋势** | 15% | 近 30 天 vs 历史评分的差值 |
| **新鲜度** | 10% | 上架 30 天内有加成，之后衰减 |

```
store_score = 0.30 × normalized_rating
            + 0.25 × normalized_installs
            + 0.20 × retention_rate
            + 0.15 × trend_bonus
            + 0.10 × freshness_bonus
```

这些权重存在 `platform_config` 中，可以动态调整。

---

## 14.8 开发者 Dashboard 评分板块

开发者可以在 Developer Console 看到：

```
┌─────────────────────────────────────────┐
│  我的应用评分概览                          │
├─────────────────────────────────────────┤
│                                         │
│  Rich Game          ★ 4.5 (1,234)  ↑   │
│  My Quiz App        ★ 4.2 (89)     →   │
│  Daily Tracker      ★ 3.8 (45)     ↓   │
│                                         │
├─────────────────────────────────────────┤
│  Rich Game — 评分趋势（30天）             │
│                                         │
│  5 ★  ┃ ████████████████████  68%       │
│  4 ★  ┃ ██████               20%       │
│  3 ★  ┃ ██                    7%       │
│  2 ★  ┃ █                     3%       │
│  1 ★  ┃ █                     2%       │
│                                         │
│  最新评论 (需要回复: 3)                   │
│  ┌───────────────────────────────────┐  │
│  │ @user123  ★★★★★  3小时前          │  │
│  │ 很好玩！策略性很强                   │  │
│  │                        [回复]      │  │
│  ├───────────────────────────────────┤  │
│  │ @gamer42  ★★☆☆☆  1天前            │  │
│  │ 经常卡顿，希望优化                   │  │
│  │                        [回复]      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 14.9 SDK 接口

应用可以通过 SDK 引导用户评分（但不能强制或激励）：

```typescript
// 应用内引导评分（类似 iOS SKStoreReviewController）
// 平台控制弹窗频率：每用户每应用最多 3 次/年
const result = await billai.ui.requestReview();
// result: 'submitted' | 'dismissed' | 'already_reviewed' | 'rate_limited'
```

**限制**：
- 平台控制弹窗频率，防止应用频繁骚扰用户
- 弹窗由平台渲染（不是应用自己画的），确保评分直接提交到平台
- 应用不能读取用户给自己的评分（防止区别对待）

---

## 14.10 数据库设计

### 评价表（已在 12-tech-decisions.md，补充字段）

```sql
CREATE TABLE app_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  app_id TEXT REFERENCES apps(app_id) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,                           -- 评论文字（可选）
  app_version TEXT,                       -- 评价时的应用版本
  helpful_count INTEGER DEFAULT 0,        -- "有用"票数
  status TEXT DEFAULT 'visible',          -- visible / hidden / flagged
  weight FLOAT DEFAULT 1.0,              -- 信誉权重（0=不计入）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, app_id)
);
```

### 开发者回复表（新建）

```sql
CREATE TABLE review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES app_reviews(id) NOT NULL,
  developer_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE(review_id)                       -- 每条评论只能回复一次
);
```

### "有用"投票表（新建）

```sql
CREATE TABLE review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES app_reviews(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)              -- 每人每评论只能投一次
);
```

### apps 表补充字段

```sql
ALTER TABLE apps ADD COLUMN avg_rating FLOAT DEFAULT 0;
ALTER TABLE apps ADD COLUMN weighted_rating FLOAT DEFAULT 0;  -- 贝叶斯加权分
ALTER TABLE apps ADD COLUMN review_count INTEGER DEFAULT 0;
```

### 评分缓存刷新（定时任务）

```sql
-- 每小时执行，更新 apps 表的缓存评分
UPDATE apps SET
  avg_rating = sub.avg_r,
  review_count = sub.cnt,
  weighted_rating = (sub.cnt * sub.avg_r + 10 * :global_avg) / (sub.cnt + 10)
FROM (
  SELECT app_id,
         AVG(rating)::FLOAT as avg_r,
         COUNT(*) as cnt
  FROM app_reviews
  WHERE status = 'visible' AND weight > 0
  GROUP BY app_id
) sub
WHERE apps.app_id = sub.app_id;
```

---

## 14.11 实现阶段

| Phase | 功能 | 说明 |
|-------|------|------|
| **1** | 基础评分 | 1-5 星 + 文字评论、平均分显示、评分分布条形图 |
| **1** | 评分门槛 | 使用时长 ≥ 5min + 安装 ≥ 1 天 |
| **2** | 开发者回复 | 回复评论 + 开发者标签 |
| **2** | "有用"按钮 | 投票 + 按有用度排序 |
| **2** | 评论审核 | 接入内容审核管道 |
| **3** | 贝叶斯加权 | 加权评分 + 商店排序算法 |
| **3** | 防刷检测 | 异常模式检测 + 人工审核标记 |
| **3** | 评分趋势 | 30 天趋势、开发者 Dashboard 评分板块 |
| **4** | SDK 评分引导 | `billai.ui.requestReview()` + 频率控制 |

---

## 14.12 与其他系统的关联

| 系统 | 关联 |
|------|------|
| 应用商店（01/02） | 评分是商店排序的核心信号 |
| 合规审核（05） | 评论内容接入审核管道 |
| 分润（06） | 低评分应用可能触发平台审查 |
| 订阅（07） | 应用评分影响用户续订决策 |
| 推广（08） | 推广页面展示应用评分 |
