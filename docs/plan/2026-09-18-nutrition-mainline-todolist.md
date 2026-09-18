# Nutrition 主线执行清单 / ToDo

更新：2026-09-18 晚间  
原则：本清单按最初产品目标排序，不以“做更多功能”为完成标准。

## 0. 当前权威快照

```text
canonical = /Users/zon/Desktop/MINE/html/nutrition-ledger-mvp
main = 298cd1f1e46a62d1cd83efca79be73edbadd6c32
test = 244f4c188993e0633833a0b9fd936afedb29605c
consumer = CONSUMER_VERIFIED
worktree = 1
local branches = 0
Day 1 = PASS
Day 2 = PASS
Day 3–7 = PENDING
parser #19 = FIXED
correction #28 = CANDIDATE_VERIFIED / INTEGRATION_DEFERRED
Coverage #26 = BLOCKED ON #18 + #28
main / Production = NOT PROMOTED
```

业务状态优先读：
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/10
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/18
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/28
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/26

## P0 — 当前必须完成

### P0.1 Consumer / worktree / private-data continuity — DONE

- [x] #24 completed  
  https://github.com/EOMZON/nutrition-ledger-mvp/issues/24
- [x] #25 completed  
  https://github.com/EOMZON/nutrition-ledger-mvp/issues/25
- [x] #10 已刷新为最新 `CONSUMER_VERIFIED`
- [x] #18 已转入真实 7-day gate
- [x] 真实 canonical 已恢复并确认
- [x] 冗余 fresh clone 已退出
- [x] private data / blobs preserved
- [x] parser real-data readback PASS

完成依据：

```text
canonical HEAD = test@244f4c188993e0633833a0b9fd936afedb29605c
worktree = 1
local branches = 0
MERGED_EQUIVALENT
SYNCHRONIZED
CANONICAL_VERIFIED
CONSUMER_VERIFIED
audit:data = ok=true / issues=[]
```

### P0.2 冻结 dogfood runtime baseline

- [x] 7-day 期间固定 `test@244f4c188993e0633833a0b9fd936afedb29605c`
- [x] Draft docs PR #27 不因文档完整而 merge test
- [x] Correction PR #29 保持 Draft
- [ ] 只有真实 P0 blocker 才允许评估移动 test
- [ ] target 一旦移动，旧 consumer receipt 自动失效并重新 readback

### P0.3 完成 Day 3–7

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/18

当前：

- [x] Day 1
- [x] Day 2
- [ ] Day 3
- [ ] Day 4
- [ ] Day 5
- [ ] Day 6
- [ ] Day 7

每天仅记录脱敏统计：

```text
date
eatingEvents
captureEvents
repeatEvents
barcodeEvents
aiEstimateEvents
medianSeconds
p90Seconds
manualCorrections
structuralRepairs
silentHistoricalChanges
sourceMissingCount
unknownNutritionCount
```

Final Gate：

- [ ] 连续 7 个自然日
- [ ] normal records ≥80% ≤30s
- [ ] repeat ≤10s
- [ ] silent historical changes = 0
- [ ] imported observation 都有 source + method
- [ ] export 可解释
- [ ] structural repairs <10%
- [ ] 用户自然愿意继续使用

### P0.4 Append-only correction — CANDIDATE VERIFIED

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/28

Draft PR：
https://github.com/EOMZON/nutrition-ledger-mvp/pull/29

Candidate：
`60b8dc0fbc7056b6b359f05149c4cf0c71e84fe9`

Exact-SHA verification：
https://github.com/EOMZON/nutrition-ledger-mvp/actions/runs/35312188955

已完成：

- [x] `observation.invalidate` append-only event
- [x] 原 observation 永久保留
- [x] active / invalidated resolver
- [x] selected invalidated → explicit unresolved
- [x] 不静默 fallback
- [x] LedgerClient mutation
- [x] audit dangling invalidation / warning
- [x] History invalidated badge + reason
- [x] invalidated observation 禁止重新选用
- [x] frozen historical intake 不回写
- [x] sanitized unit / browser fixture
- [x] unit 14/14
- [x] browser 13/13
- [x] visual 2/2
- [x] screenshot evidence
- [x] isolated audit

仍需：

- [ ] Day 7 后重新 compare current test
- [ ] 若 target 已移动则 reverify
- [ ] integration owner 决定吸收 PR #29
- [ ] merge 后 exact test SHA verification
- [ ] canonical consumer resync
- [ ] real-ledger correction 前 backup / exact observation identity readback
- [ ] 对真实 3 条旧错误 NRV 执行 append-only invalidation
- [ ] correction 后 audit / export / Today readback

### P0.5 已知历史错误

当前已知旧 parser 错误 NRV：

- 3 条 known-invalid observation；
- 不在公共 Issue 保存私人食物身份；
- 不删除、不覆盖；
- #26 Coverage 不得消费这些值；
- correction integration 前保持已知 blocker 状态。

## P1 — #18 + #28 收口后启动

### P1.1 Coverage / Remaining / Unknown

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/26

目标链路：

```text
effective observation
→ frozen intake
→ DailyNutrientAggregate
→ CoverageState
→ DailyCoverageViewModel
→ UI
```

Domain：

- [ ] NutrientTarget
- [ ] DailyNutrientAggregate
- [ ] CoverageState

Application：

- [ ] BuildDailyAggregate
- [ ] EvaluateCoverage

Presentation：

- [ ] DailyCoverageViewModel
- [ ] CoverageSummary
- [ ] NutrientCoverageRow
- [ ] UnknownDataNotice
- [ ] ProvenanceLegend

硬规则：

- [ ] UNKNOWN != 0
- [ ] UNKNOWN != REMAINING
- [ ] AI estimate 保留不确定性
- [ ] invalidated observation 不进入 Coverage
- [ ] target 变化不改历史 intake
- [ ] UI 不自己计算营养事实

### P1.2 第一刀营养素

只使用当前可靠字段：

- energy
- protein
- fat
- saturated fat
- carb
- sugars
- fiber
- sodium

第一版先验证“Today Decision Layer 是否有价值”，不以营养素数量取胜。

## P2 — 产品验证

### P2.1 5–10 人 Beta

- [ ] Day1 → Day7 retention
- [ ] capture / repeat duration
- [ ] correction frequency
- [ ] UNKNOWN 比例
- [ ] provenance 查看
- [ ] 是否主动打开 Coverage
- [ ] Coverage 是否影响下一餐选择

## P3 — Release Gate

CreationOS：
https://github.com/EOMZON/creationos-os/issues/59

- [ ] real Vercel project-context build
- [ ] release exact SHA
- [ ] test→main 明确授权
- [ ] Production deploy
- [ ] protected access / SSO readback
- [ ] public alias readback
- [ ] rollback point

## 当前使用 / 部署真相

真实 dogfood：

```text
http://127.0.0.1:8789
```

完整状态：
https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/operations/2026-09-18-current-usage-and-deployment-status.md

- [x] 本机最新 consumer = `test@244f4c1...`
- [x] private ledger continuity 已确认
- [ ] 最新 P1 Production 尚未发布
- [ ] 历史 Vercel deployment 当前可达性未 provider readback
- [ ] #59 前禁止把旧 URL 当当前正式线上

## Git / Worktree Gate

必须始终区分：

```text
SOURCE_SAVED
!= MERGED
!= SEMANTICALLY_RECONCILED
!= TARGET_VERIFIED
!= CONSUMER_UPDATED
```

参考：
- https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md
- https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/merge-reconciliation.md
- https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/post-merge-synchronization.md
- https://github.com/EOMZON/codex-skills-private/issues/29

## 暂缓 / 非目标

- 菜谱
- 库存
- 购物
- 社区
- AI 医疗教练
- Apple Health 总控
- 新数据库
- React/framework 重写
- 未验证 provider 扩张
