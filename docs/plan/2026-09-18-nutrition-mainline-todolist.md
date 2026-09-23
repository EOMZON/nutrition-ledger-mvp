# Nutrition 主线执行清单 / ToDo

更新：2026-09-23
原则：本清单按最初产品目标排序，不以“做更多功能”为完成标准。

## 0. 当前权威快照

```text
current data location = Local Mac historical canonical ledger
future primary implementation = Virtual Server
GitHub = source / governance
Cloud / Provider = runtime / persistence / production

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

**术语纠正：**
```text
local-first canonical
= 当前数据位置的事实描述
!= 未来 implementation environment
```

未来 implementation 默认在 Virtual Server 推进；Local Mac 只在 VM 缺历史/私有资料时提供 Source Acquisition。

业务状态优先读：
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/10
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/18
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/28
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/26
- https://github.com/EOMZON/nutrition-ledger-mvp/issues/34

跨仓协调：
- https://github.com/EOMZON/product-hub/issues/95
- https://github.com/EOMZON/product-hub/issues/96
- https://github.com/EOMZON/creationos-os/issues/166
- https://github.com/EOMZON/creationos-os/issues/169

## P0 — 当前必须完成

### P0.1 Consumer / worktree / private-data continuity — DONE

- [x] #24 completed
- [x] #25 completed
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

- [x] Day 1
- [x] Day 2
- [ ] Day 3
- [ ] Day 4
- [ ] Day 5
- [ ] Day 6
- [ ] Day 7

数据库选型不得阻断该 Gate；daily writer 保持不变。

### P0.4 Append-only correction — CANDIDATE VERIFIED

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/28

仍需：
- [ ] Day 7 后重新 compare current test
- [ ] integration owner 决定吸收 PR #29
- [ ] merge 后 exact test SHA verification
- [ ] canonical consumer resync
- [ ] real-ledger correction 前 backup / exact observation identity readback
- [ ] real correction
- [ ] correction 后 audit / export / Today readback

### P0.5 Database Selection + Three-Environment Gate

Issue：
https://github.com/EOMZON/nutrition-ledger-mvp/issues/34

Cross-repo：
https://github.com/EOMZON/product-hub/issues/96

CreationOS：
https://github.com/EOMZON/creationos-os/issues/169

#### Environment contract

```text
Local Mac
= Source Acquisition / Legacy Material Recovery

Virtual Server
= Primary Implementation
= clone / worktree / code / tests / migration rehearsal / verification

Cloud / Provider
= persistence / runtime / production
```

#### Database decision dependency

```text
Database Selection
→ allocation / lifecycle
→ provider capability
→ minimum permissions
→ persistence adapter
→ migration rehearsal
→ data verification
→ controlled cutover
→ consumer readback
```

候选至少包括：
- Cloudflare D1
- Managed PostgreSQL
- Virtual Server SQLite / file DB

至少比较：
- cost / free tier / growth cost
- storage / read / write / limits
- backup / restore / recovery
- VM network access
- secrets / roles / least privilege
- test/staging/production isolation
- ops burden
- lock-in
- restore blast radius
- Nutrition private-data fit

**本阶段只做选型与 capability contract，不创建/迁移数据库。**

## P1 — #18 + #28 收口后启动

### P1.1 Persistence Port / Adapter

目标：

```text
Nutrition Domain
→ Repository / Persistence Port
→ Adapter
→ selected provider
```

原则：
- Domain 不绑定 DB。
- UI 不直接读写 DB。
- Projection / ViewModel 独立。
- adapter 替换 provider，而不是重写 domain semantics。

启动条件：
- #18 Day7 completed
- #28 integration / historical correction decision completed
- Database Selection 已有明确结果
- Virtual Server minimum provider permissions 可用

### P1.2 Coverage / Remaining / Unknown

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

硬规则：
- UNKNOWN != 0
- UNKNOWN != REMAINING
- invalidated observation 不进入 Coverage
- target 变化不改历史 intake
- UI 不自己计算营养事实

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

若采用 remote persistence：
- [ ] selected provider exact resource identity
- [ ] migration evidence
- [ ] backup/restore rehearsal
- [ ] exact source/target SHA
- [ ] consumer readback
- [ ] rollback point
- [ ] authorized test→main→production path

## 当前使用 / 部署真相

当前业务 dogfood 的历史 runtime 状态见：
https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/xhs-opportunity-followup-20260918/docs/operations/2026-09-18-current-usage-and-deployment-status.md

注意：该运行事实不定义未来主实现环境。未来实现默认以 Virtual Server 为主。

## Git / Worktree Gate

始终区分：

```text
SOURCE_SAVED
!= MERGED
!= SEMANTICALLY_RECONCILED
!= TARGET_VERIFIED
!= CONSUMER_UPDATED
```

必须参考：
- https://github.com/EOMZON/codex-skills-private/blob/task/issue-governance-20260920/github-ops/references/issue-governance.md
- https://github.com/EOMZON/codex-skills-private/blob/task/issue-governance-20260920/github-ops/templates/issue-template.md
- https://github.com/EOMZON/codex-skills-private/blob/9a8e385ccc98f068b0990133f9a2e80681ffa9ec/github-ops/references/test-main-governance.md
- https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/SKILL.md
- https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/merge-reconciliation.md
- https://github.com/EOMZON/codex-skills-private/blob/main/worktree-audit/references/post-merge-synchronization.md
- https://github.com/EOMZON/codex-skills-private/issues/29

## 时间节点

- 2026-09-23：三环境边界与 Database Selection Gate 正式进入主线。
- 2026-09-24：完成 selection matrix / registry decision / minimum permission request。
- #18 Day7：完成 dogfood，保持 writer 不变。
- #28 integration：固定 correction semantics。
- #34：进入 adapter implementation planning。
- #26 Coverage MVP 前：完成 recovery story。
- Beta 前：完成 backup/restore rehearsal。
- #59 Release Gate：若 remote DB 被选中，完成完整 migration/recovery/readback。

## 暂缓 / 非目标

- 菜谱
- 库存
- 购物
- 社区
- AI 医疗教练
- Apple Health 总控
- React/framework 重写
- 未验证 provider 扩张
- 为了数据库选型而中断 daily capture
- 把 Local Mac 当未来主实现环境
