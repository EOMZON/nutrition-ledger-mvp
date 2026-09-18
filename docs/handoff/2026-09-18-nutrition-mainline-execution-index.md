# Nutrition 主线 AI 执行索引

用途：后续云端 / 本机 AI 接手时，先读这些 GitHub 文档与 Issue，不从聊天重新拼上下文。

## 1. 最初目标与当前全盘复盘

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/analysis/2026-09-18-nutrition-mainline-gap-timeline-review.md

## 2. 当前架构 / 理想架构 / Mermaid

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/architecture/2026-09-18-nutrition-current-vs-ideal-architecture.md

## 3. ToDo / 优先级

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/plan/2026-09-18-nutrition-mainline-todolist.md

## 4. XHS 产品化参考

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/analysis/2026-09-18-xhs-opportunity-productization-mainline.md

## 5. 业务 Issues

主线：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/10

7-day：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/18

历史 observation correction：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/28

Coverage future P1：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/26

## 6. 本机 / worktree 历史回执

https://github.com/EOMZON/nutrition-ledger-mvp/issues/24
https://github.com/EOMZON/nutrition-ledger-mvp/issues/25

## 7. Cross-repo

Release Gate：
https://github.com/EOMZON/creationos-os/issues/59

Product Hub / Context：
https://github.com/EOMZON/creationos-os/issues/128

Worktree / Merge Reconciliation：
https://github.com/EOMZON/codex-skills-private/issues/29

## 8. Git 治理

https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md

https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/SKILL.md

https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/merge-reconciliation.md

https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/post-merge-synchronization.md

## 9. 当前执行边界

本机主线：
```text
同一真实 private ledger
→ Day 2–7
→ 脱敏 daily receipt
```

云端完全解耦：
```text
#28 correction contract / fixture / review
```

现在不要：
```text
#26 runtime implementation
test→main
Production
merge PR #27 only for docs
new Nutrition repo
```
