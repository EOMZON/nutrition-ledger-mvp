# Nutrition 主线执行清单 / ToDo

更新：2026-09-18  
原则：本清单按最初产品目标排序，不以“做更多功能”为完成标准。

## P0 — 当前必须完成

### P0.1 收口已经完成的 consumer-sync Issues

- [ ] #24 标记 superseded/completed  
  https://github.com/EOMZON/nutrition-ledger-mvp/issues/24
- [ ] #25 标记 completed  
  https://github.com/EOMZON/nutrition-ledger-mvp/issues/25
- [ ] #10 更新标题/正文为最新 `CONSUMER_VERIFIED / DAY1 PASS`
- [ ] #18 去掉过时的 `RESYNC_REQUIRED`

完成依据：
- real canonical = `/Users/zon/Desktop/MINE/html/nutrition-ledger-mvp`
- exact consumer = `test@244f4c188993e0633833a0b9fd936afedb29605c`
- worktree = 1
- local branch = 0
- private data/blobs preserved
- audit = PASS

### P0.2 冻结 dogfood runtime baseline

- [ ] 7-day 期间默认不移动 `test@244f4c1...`
- [ ] Draft PR #27 保持 Draft
- [ ] 只有真实 P0 blocker 修复才能移动 test
- [ ] target 一旦移动，旧 consumer receipt 自动失效并重新 readback

### P0.3 完成 Day 2–7

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/18

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

最终 Gate：
- [ ] normal records ≥80% ≤30s
- [ ] repeat ≤10s
- [ ] silent historical changes = 0
- [ ] imported observation 都有 source + method
- [ ] export 可解释
- [ ] structural repairs <10%
- [ ] 用户自然愿意连续使用

### P0.4 设计 append-only correction

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/28

候选 contract：

```text
observation.invalidate
{
  observationId,
  reason,
  evidenceRef,
  createdAt
}
```

需要完成：
- [ ] domain contract
- [ ] effective resolver 行为
- [ ] selection 行为
- [ ] export/audit 行为
- [ ] UI 可见性
- [ ] sanitized fixture
- [ ] unit tests
- [ ] 不修改真实 ledger
- [ ] 不移动 test，除非经过独立 review + dogfood 时机判断

### P0.5 已知历史错误

当前已知旧 parser 错误 NRV：
- 3 条 known-invalid observation；
- 不在公共 Issue 保存私人食物身份；
- 不删除、不覆盖；
- correction contract 落地前明确标记为 known blocker；
- #26 Coverage 不得消费这些值。

## P1 — 7-day 后启动

### P1.1 Coverage / Remaining / Unknown

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/26

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
- [ ] Unknown 不等于 0
- [ ] Unknown 不等于 Remaining
- [ ] AI estimate 保留不确定性
- [ ] target 变化不改历史 intake
- [ ] UI 不自己计算营养事实

### P1.2 第一版 Coverage 营养素

优先只使用现有可靠字段：
- energy
- protein
- fat
- saturated fat
- carb
- sugars
- fiber
- sodium

微量营养素不在第一刀扩张。

## P2 — 产品验证与发布

### P2.1 5–10 人 Beta
- [ ] Day1→Day7 retention
- [ ] capture / repeat duration
- [ ] correction frequency
- [ ] Unknown 比例
- [ ] provenance 查看
- [ ] 是否主动看 Coverage
- [ ] 是否影响下一餐选择

### P2.2 Release Gate

CreationOS：
https://github.com/EOMZON/creationos-os/issues/59

- [ ] real Vercel project-context build
- [ ] release exact SHA
- [ ] test→main authorization
- [ ] Production deploy
- [ ] SSO/protected access readback
- [ ] public alias readback
- [ ] rollback point

## 暂缓 / 非目标

- 菜谱
- 库存
- 购物
- 社区
- AI 医疗教练
- Apple Health 总控
- 新数据库
- React/framework 重写
- 未验证的 provider 扩张
