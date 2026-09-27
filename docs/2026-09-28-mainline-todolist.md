
# Nutrition 主线 ToDo · 2026-09-28

## P0-A 数据完整性

- [ ] PR #36 range safety 重新 exact-SHA verify
- [ ] 合入当前 test 前完成 semantic reconciliation
- [ ] canonical consumer readback
- [ ] #35 只有在 target + consumer 都完成后才保持 CLOSED

## P0-B 历史正确性

- [ ] #28 与最新 test 重新 compare
- [ ] 重新验证 candidate
- [ ] real-ledger backup
- [ ] 确认 3 条旧 NRV observation identity
- [ ] append-only invalidation
- [ ] audit / export / Today readback
- [ ] #28 closeout

## P0-C 原始产品价值

- [ ] #18 重新核对是否仍作为 7-day primary gate
- [ ] 如果继续，补齐 7-day receipt / criteria
- [ ] 不把 #33 单次 lunch dogfood 当成 7-day completion

## P1 Coverage

- [ ] #26 Coverage domain
- [ ] DailyNutrientAggregate
- [ ] NutrientTarget
- [ ] CoverageState
- [ ] Covered / Remaining / Unknown
- [ ] confidence / sourceCompleteness
- [ ] Today ViewModel
- [ ] UI regression

## P1 Product validation

- [ ] 5–10 real users
- [ ] D1/D3/D7
- [ ] capture median / p90
- [ ] repeat time
- [ ] correction rate
- [ ] unknown rate
- [ ] Coverage interaction
- [ ] qualitative “今天还差什么”是否真正帮助用户

## P2 Infrastructure

- [ ] #34 Virtual Server contract
- [ ] Persistence Port
- [ ] Adapter
- [ ] selected provider
- [ ] backup/restore rehearsal
- [ ] migration
- [ ] production release gate

## 明确禁止

- [ ] 不创建第二 ledger
- [ ] 不在 Product Hub 保存私人 nutrition data
- [ ] 不提前做 AI coach
- [ ] 不提前做 recipes/inventory/community
- [ ] 不在 test frozen 时做无关 feature
