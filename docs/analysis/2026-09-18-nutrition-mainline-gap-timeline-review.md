# Nutrition 主线全盘复盘：最初目标、当前状态、差距与时间线

日期：2026-09-18  
业务仓：`EOMZON/nutrition-ledger-mvp`  
当前远端 integration target：`test@244f4c188993e0633833a0b9fd936afedb29605c`  
正式基线：`main@298cd1f1e46a62d1cd83efca79be73edbadd6c32`（未推广）

## 1. 最初目标

最初目标不是做“大而全营养平台”，而是完成一个真正每天愿意使用的个人营养账本：

```text
吃了什么
→ 快速记录
→ 来源可见
→ 错了可修
→ Today 冻结历史
→ 下次快速复用
→ 连续每天愿意真实使用
```

XHS 31/31 评论补充的下一层产品价值是：

```text
我已经知道今天吃了什么
→ 那今天哪些已经覆盖？
→ 还剩哪些？
→ 哪些只是数据未知？
```

因此最终产品定义保持：

> Evidence-first Personal Nutrition Ledger：快速记录真实饮食，保留营养数据来源与不确定性，冻结历史，并在用户明确设定/选择目标后告诉用户 COVERED / REMAINING / UNKNOWN。

非目标：
- 菜谱；
- 库存；
- 购物；
- 社区；
- AI 医疗建议；
- Apple Health 总控；
- 大规模框架迁移；
- 第二套 Nutrition 数据库/状态机。

## 2. 当前真实状态

### 2.1 远端代码

```text
main = 298cd1f1e46a62d1cd83efca79be73edbadd6c32
test = 244f4c188993e0633833a0b9fd936afedb29605c
```

当前 `test` 保持为已验证 integration candidate；`main` / Production 未推广。

关键 lineage：

```text
4e735a0  Today P1 合入 test
   ↓
457d5c2  dogfood / parser handoff docs
   ↓
a6a4527  NRV parser 修复
   ↓
f617184  NRV regression tests
   ↓
244f4c1  parser fix 正式进入 test
```

### 2.2 本机 consumer / worktree / private data

最新真实 canonical：

```text
/Users/zon/Desktop/MINE/html/nutrition-ledger-mvp
```

最新本机回执已经确认：

- canonical HEAD = `244f4c188993e0633833a0b9fd936afedb29605c`
- worktree = 1
- local branch = 0，detached at `origin/test`
- tracked dirty = 0
- existing untracked `.playwright-cli/` 保留
- ignored private data / blobs 保留
- `CANONICAL_VERIFIED`
- `CONSUMER_VERIFIED`
- Post-Merge = `SYNCHRONIZED`
- unit 10/10
- real-data parser dogfood PASS
- audit:data = `ok=true / issues=[]`

误建立的无私人数据 fresh clone 已移入系统 Trash，当前不再作为 canonical consumer。

证据：
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/25
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/24

## 3. 已完成能力

- Today-first 默认日用入口；
- legacy workbench 保留；
- meal first-class + 历史 note fallback；
- domain nutrient registry；
- saturated fat / sugars / fiber；
- provenance / method / source；
- `AI 粗估 · 约`；
- recent / common / repeat；
- quick add；
- barcode → Open Food Facts → confirm → Today；
- append-only intake；
- frozen historical snapshot；
- data audit；
- unit / E2E / visual；
- 真实 1-day dogfood；
- NRV parser dogfood bug 已修复。

速度证据（Day 1）：
- existing food ≈ 3 秒；
- recent repeat ≈ 2 秒；
- ordinary Capture parse+commit ≈ 2 秒；
- barcode lookup / confirm 已真实使用。

## 4. 当前未完成

### P0：7-day dogfood

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/18

当前只有 Day 1，不能由单次 AI 伪造 Day 2–7。

### P0/P1：历史错误 NRV correction

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/28

旧 parser 曾写入 3 条错误 NRV observation。当前 parser 已修复，新数据不再继续污染；但 append-only ledger 缺少安全的 invalidate/supersede/unset 语义。

原则：
- 不删除 JSONL 行；
- 不覆盖 observation；
- 不静默改写；
- 历史仍可审计；
- invalid observation 不能继续进入 effective selection / Coverage。

### P1：Coverage / Remaining / Unknown

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/26

在 7-day 和 correction 语义没有稳定前不进入大规模实现。

## 5. 时间线

| 日期 | 节点 | 状态 |
|---|---|---|
| 2026-08-31 | production baseline / Preview / Production 验证 | 已有历史证据 |
| 2026-09-16 | production baseline + Daily Nutrition 分层 reconciliation | 完成 |
| 2026-09-17 | Today P1 合入 test | 完成 |
| 2026-09-17 | 本机 real-data audit + Day 1 dogfood | 完成 |
| 2026-09-17 | dogfood 暴露 NRV parser bug | 已定位 |
| 2026-09-18 | parser fix + source exact-SHA + post-merge exact-SHA | 完成 |
| 2026-09-18 | 真实 canonical 对齐最新 test；fresh clone 退出 | 完成 |
| 2026-09-18 起 | Day 2–7 dogfood | 进行中 |
| 7-day 后 | Coverage contract / MVP | BLOCKED |
| Beta 后 | Vercel / test→main / Production | BLOCKED |

## 6. 当前最主要差距

```text
记录层        ≈ 已完成
可信/追溯层   ≈ 已完成
真实 Day 1    = PASS
真实 Day 2–7  = PENDING
Correction    = 缺 invalidate/supersession
Coverage      = 尚未实现
Beta          = 尚未开始
Production    = 有意暂停
```

## 7. 当前决策

### 现在做

1. 冻结 `test@244f4c1...` 作为 dogfood runtime baseline；
2. 完成同一真实 private ledger 的 Day 2–7；
3. 并行设计 #28 append-only correction contract；
4. 只更新 Issue / docs / Context pointer，不为文档移动 test；
5. 7-day 结束后评估 #26。

### 现在不做

- 不合并 docs Draft PR 仅为了“看起来完整”；
- 不启动 Coverage 大规模开发；
- 不 test→main；
- 不 Production；
- 不迁移私人 data；
- 不删除历史错误 observation。

## 8. Canonical links

业务：
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/10
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/18
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/28
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/26

跨仓：
- https://github.com/EOMZON/creationos-os/issues/59
- https://github.com/EOMZON/creationos-os/issues/128
- https://github.com/EOMZON/codex-skills-private/issues/29

治理：
- https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md
- https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/SKILL.md
- https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/merge-reconciliation.md
- https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/post-merge-synchronization.md
