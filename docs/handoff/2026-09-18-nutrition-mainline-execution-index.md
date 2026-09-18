# Nutrition 主线 AI 执行索引

用途：后续云端 / 本机 AI 接手时，先读这些 GitHub 文档与 Issue，不从聊天重新拼上下文。

## 1. 当前权威状态

```text
main = 298cd1f1e46a62d1cd83efca79be73edbadd6c32
test = 244f4c188993e0633833a0b9fd936afedb29605c
canonical = /Users/zon/Desktop/MINE/html/nutrition-ledger-mvp
consumer = CONSUMER_VERIFIED
Day 1 = PASS
Day 2 = PASS
Day 3–7 = PENDING
#28 = CANDIDATE_VERIFIED / INTEGRATION_DEFERRED
#26 = BLOCKED ON #18 + #28
Production = NOT PROMOTED
```

如果其它文档/Issue body 与这里冲突，以业务仓 #10/#18/#28/#26 的最新状态为准。

## 2. 最初目标与当前全盘复盘

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/analysis/2026-09-18-nutrition-mainline-gap-timeline-review.md

## 3. 当前架构 / 理想架构 / Mermaid

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/architecture/2026-09-18-nutrition-current-vs-ideal-architecture.md

## 4. ToDo / 优先级

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/plan/2026-09-18-nutrition-mainline-todolist.md

## 5. XHS 产品化参考

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/analysis/2026-09-18-xhs-opportunity-productization-mainline.md

## 6. 当前怎么用 / 是否线上

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/operations/2026-09-18-current-usage-and-deployment-status.md

关键结论：

```text
current real usage = http://127.0.0.1:8789
latest P1 Production = NO
historical Vercel Production = evidence only / current availability unverified
local private ledger != historical cloud KV
```

## 7. 业务 Issues

主线：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/10

7-day：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/18

历史 observation correction：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/28

Coverage future P1：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/26

### #28 Correction Candidate

Draft PR：
https://github.com/EOMZON/nutrition-ledger-mvp/pull/29

Verification：
https://github.com/EOMZON/nutrition-ledger-mvp/actions/runs/35312188955

状态：

```text
CANDIDATE_VERIFIED
INTEGRATION_DEFERRED
REAL_LEDGER_NOT_MUTATED
TEST_NOT_MOVED
```

当前不要继续堆零碎提交。等 #18 Day7 后重新 compare current test，再由一个 integration owner 决定吸收。

## 8. 本机 / worktree 历史回执

已完成：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/24
https://github.com/EOMZON/nutrition-ledger-mvp/issues/25

不要再创建 fresh clone 替代真实 canonical。

## 9. Cross-repo

Release Gate：
https://github.com/EOMZON/creationos-os/issues/59

Product Hub：
https://github.com/EOMZON/creationos-os/issues/128

Worktree / Merge Reconciliation：
https://github.com/EOMZON/codex-skills-private/issues/29

## 10. Git 治理

https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/SKILL.md

https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/merge-reconciliation.md

https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/post-merge-synchronization.md

## 11. 当前执行边界

本机唯一主线：

```text
同一真实 private ledger
→ Day 3–7
→ 每天脱敏 receipt
→ #18
```

云端可做：

```text
#28 read-only review / integration planning
docs / Context freshness
```

现在不要：

```text
merge PR #29
#26 runtime implementation
test→main
Production
new Nutrition repo
move private data root
```

## 12. Day7 后执行顺序

```text
#18 closeout
→ recompare PR #29 vs current test
→ merge / exact-SHA verify
→ canonical consumer resync
→ real-ledger backup + exact observation identity
→ append-only invalidation of 3 known-invalid NRV observations
→ audit / export / Today readback
→ #26 Coverage MVP
```
