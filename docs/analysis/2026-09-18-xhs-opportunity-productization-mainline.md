# 小红书验证后的 Nutrition 产品化主线与当前 Gate

日期：2026-09-18  
仓库：`EOMZON/nutrition-ledger-mvp`  
状态：策略/执行约束候选；业务代码当前以 `test` 为 integration target

## 1. 当前事实修正

旧归档中“只有实验和设计、没有可持续前端产品”的判断已经落后。

截至 2026-09-18：

- Nutrition Today P1 已进入 `test`；
- 真实本机 private data audit 已通过；
- canonical consumer 曾验证到旧的 `test@4e735a0...`；
- 1-day dogfood 已完成；
- 已有食物快速记录约 3 秒；
- 最近食物重复约 2 秒；
- 普通首次 Capture 解析+写入约 2 秒；
- dogfood 发现 NRV parser 语义错误；
- parser fix 已通过 PR #22 合入 `test@244f4c188993e0633833a0b9fd936afedb29605c`；
- post-merge verification workflow 已成功；
- **但本机 consumer 对新的 `test@244f4c...` 尚未有新的 readback 证据**；
- 7-day dogfood 尚未完成；
- `main` / Production 尚未推广。

因此现在的真实状态是：

```text
业务实现：接近候选
技术 target：已验证到新 test SHA
本机 consumer：对新 test SHA 待重新验证
日用留存：1-day pass / 7-day pending
核心产品价值“今天还差什么”：尚未闭环
Production：未发布
```

## 2. 小红书需求证据

该笔记评论 31/31 已完整抓取。

高频信号：

- “输入每天吃了啥，自动计算还差哪些营养物质”；
- “现有 App 只有碳水/脂肪/蛋白质简单统计”；
- 长期追问“开发出来了吗”“有结果了吗”；
- 用户关心维生素 K 等微量营养素；
- 多次“蹲”“同蹲”，说明需求没有自然消失。

不能把评论数量直接当成付费验证，但它足以证明下一步不应继续只做“记录基础设施”。

## 3. 产品定义

推荐固定为：

> 一个 evidence-first 的个人营养账本：快速记录真实饮食，保留每个营养数据的来源和不确定性，并告诉用户相对于自己设定的目标，今天哪些已经覆盖、哪些还剩、哪些暂时不知道。

核心不是“AI 拍照算热量”。

核心价值链：

```text
Eat
  → Capture
  → Verify / Provenance
  → Immutable Ledger
  → Today
  → Coverage / Remaining / Unknown
  → Repeat
```

## 4. 第一目标用户

优先：

**已经主动关心饮食，但觉得传统记录太麻烦，并且关心的不只是热量和三大营养素的人。**

他们要解决的是：

- 今天实际吃了什么；
- 数值从哪里来；
- 哪些只是估计；
- 数据错了如何修；
- 历史是否会被静默改写；
- 相对自己设定的目标还有哪些未覆盖；
- 哪些只是“数据未知”，而不是“摄入不足”。

V1 不应定位为医疗决策工具。

## 5. 当前 P0：先完成 Merge → Consumer 证据链

当前最优先的不是新增功能，而是修复“target 已前进但用户本机可能仍旧”的状态。

必须区分：

```text
SOURCE_SAVED
→ MERGED
→ SEMANTICALLY_RECONCILED
→ TARGET_VERIFIED
→ CONSUMER_UPDATED
```

当前：

- parser source：已保存；
- PR #22：已 merge；
- test：`244f4c188993e0633833a0b9fd936afedb29605c`；
- post-merge workflow：success；
- 最后明确记录的 canonical consumer：旧 `4e735a0...`；
- 所以当前不能称“用户本机已经获得 NRV 修复”。

应新建本地执行 Issue，由本机目标模式：

1. live readback remote refs；
2. audit canonical checkout / worktree / local branches；
3. 不 reset/clean/stash/force；
4. 检查 ignored/private data；
5. 将 consumer 安全同步到当前已验证 test exact SHA；
6. 用原 dogfood 输入重跑 NRV 复现；
7. 本机 UI / runtime readback；
8. 写回非敏感 receipt。

在完成前，状态应明确为：

`TARGET_VERIFIED_BUT_NOT_CONSUMED` 或 `CONSUMER_UNKNOWN`，不能冒充 `CONSUMER_VERIFIED`。

## 6. P0：7-day dogfood

7-day 不能由单次云端 AI“完成”。

目标不是连续 7 天为了测试而测试，而是判断：

- 是否真的愿意每天记录；
- 哪一步最烦；
- 第一次录入与重复录入是否越来越快；
- 是否频繁需要人工修正；
- 数据是否出现 silent historical changes；
- provenance 是否足够理解；
- Today 是否真的被打开，而不仅仅是 Capture 成功。

现有 Issue #18 是唯一长期 Gate。

在该 Gate 完成前：

- 不 test→main；
- 不 Production；
- 不进行大规模新功能重写。

## 7. P1：Today Coverage / Remaining / Unknown

这是小红书原始 Promise 尚未完成的最核心产品层。

### 7.1 用户问题

不是：

> 今天摄入了 1240 kcal。

而是：

> 相对于我自己设定的目标，今天哪些已经覆盖、哪些还剩、哪些因为数据不足暂时不知道？

### 7.2 核心状态必须三分

禁止把“未知”显示成“缺乏”。

推荐：

```text
COVERED
REMAINING
UNKNOWN
```

同时展示 confidence / provenance。

例：

```text
蛋白质     68 / 90g      REMAINING 22g
膳食纤维   14 / 25g      REMAINING 11g
钙         620 / 800mg   REMAINING 180mg
维生素 C   数据不足       UNKNOWN
```

### 7.3 架构

不要让 UI 自己做营养计算。

建议：

```text
domain/
  NutrientTarget
  NutrientObservation
  IntakeSnapshot
  DailyNutrientAggregate
  CoverageState

application/
  BuildDailyAggregate
  EvaluateCoverage

repository/
  TargetRepository
  IntakeRepository

selectors/
  dailyCoverageSelector

view-model/
  DailyCoverageViewModel

presentation/
  CoverageSummary
  NutrientCoverageRow
  UnknownDataNotice
  ProvenanceLegend
```

### 7.4 Contract

`CoverageState` 至少：

```ts
{
  nutrientId,
  consumed,
  target,
  remaining,
  status: "covered" | "remaining" | "unknown",
  confidence,
  sourceCompleteness
}
```

### 7.5 目标来源

第一版只允许用户自己设置或选择明确来源的目标。

不能把“自动医学推荐”作为第一版。

药物、疾病、特殊治疗饮食只允许成为：

- user-defined watchlist；
- user-provided target；

不输出治疗/诊断判断。

## 8. 数据/UI 分离硬规则

现有 Ledger 是本产品的护城河之一，不应为了新 UI 绕开它。

```text
raw evidence / provider result
→ observation
→ selection
→ intake snapshot
→ daily aggregate
→ coverage domain
→ selector
→ view-model
→ UI
```

UI 禁止：

- 修改历史 observation；
- 从 DOM 推断营养事实；
- 直接调用数据库/provider 拼结果；
- 把缺失字段默认为 0；
- 把 AI estimate 当 verified；
- 把 Unknown 当 Remaining。

## 9. 当前不做

在 consumer sync + 7-day Gate 之前，不新增：

- 菜谱；
- 库存；
- 购物；
- AI 营养教练；
- 社区；
- Apple Health 总控；
- 大规模框架迁移；
- 医疗建议；
- 新数据库。

## 10. Beta Gate

完成 7-day 后再考虑 5–10 人 Beta。

需要观察：

- Day 1 → Day 7；
- 每天记录次数；
- 首次记录耗时；
- repeat 耗时；
- manual correction；
- Unknown 比例；
- provenance 点击/查看；
- 用户是否主动查看 Today Coverage；
- 用户是否因为“还剩什么”改变下一餐选择。

不要用点赞替代 retention。

## 11. Git / Worktree 治理

统一遵循：

- Git governance：
  https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md
- Worktree audit：
  https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/SKILL.md
- Merge Reconciliation：
  https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/merge-reconciliation.md
- Post-Merge Synchronization：
  https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/post-merge-synchronization.md
- P0：
  https://github.com/EOMZON/codex-skills-private/issues/29

### 本仓执行规则

- 同一业务 coherent set 一个 writer；
- docs/research 可以独立 task branch；
- integration owner 串行吸收进 `test`；
- 每次 `test` 移动，旧 exact-SHA 测试证据降级；
- 每次 merge 后必须对 source manifest 做 semantic reconciliation；
- 本机 canonical checkout 必须单独 readback；
- worktree=1 不能当作 consumer 已更新的证据；
- private data / blobs / env 不上传 Issue；
- 未授权不进入 main / Production。

## 12. 推荐执行顺序

```text
P0 新 test SHA 本机 consumer readback
  ↓
P0 NRV 修复本机复现关闭
  ↓
P0 继续 7-day dogfood
  ↓
P1 Coverage / Remaining / Unknown contract
  ↓
最小实现 + 真实 dogfood
  ↓
5–10 人 Beta
  ↓
Release Gate
  ↓
test → main → Production readback
```

当前最重要的约束：**不要因为“终于有用户需求”又重建一个更大的 Nutrition 系统。继续以 nutrition-ledger-mvp 为唯一业务 owner。**
