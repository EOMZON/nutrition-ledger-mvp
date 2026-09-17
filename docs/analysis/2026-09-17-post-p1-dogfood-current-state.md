# Nutrition P1 进入真实 dogfood 后的当前状态

日期：2026-09-17

## 结论

Nutrition 已经从“工程能力和测试闭环”进入“真实日用验证”阶段。

最初目标保持不变：

```text
吃了什么
→ 快速录入
→ 来源可见
→ 可修正
→ Today 冻结历史
→ 下次复用
→ 每天愿意真实使用
```

当前不是继续扩产品功能的时候。技术 P1 已经进入 `test`，本机 consumer/worktree/data 也完成收口；主线只剩：

1. 修复真实 dogfood 暴露的 Capture NRV parser 语义 bug（Issue #19）；
2. 继续同一 canonical ledger 的连续 7-day dogfood（Issue #18）；
3. 两者收口后才讨论 `test → main` / Production。

---

## 1. Canonical owner / refs

业务仓：

https://github.com/EOMZON/nutrition-ledger-mvp

业务总入口：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/10

当前远端：

```text
test = 4e735a0be55e00306ed0893b02d7d4e3e422e439
main = 298cd1f1e46a62d1cd83efca79be73edbadd6c32
```

P1 merge：

https://github.com/EOMZON/nutrition-ledger-mvp/pull/16

Post-merge exact-SHA verification：

https://github.com/EOMZON/nutrition-ledger-mvp/actions/runs/35182800982

完整远端验证：

https://github.com/EOMZON/nutrition-ledger-mvp/blob/test/docs/verification/2026-09-17-today-p1-remote-verification.md

---

## 2. 技术 P1 已完成

当前 `test` 已包含：

- `/` Today-first 日用入口；
- `/?legacy=1` 完整旧工作台；
- meal first-class + 历史 note fallback；
- P1 snapshot 的 domain nutrient registry；
- saturated fat / sugars / fiber；
- provenance/source badge；
- `AI 粗估 · 约`；
- 最近 / 近 30 天常用食物；
- 一键重复；
- 已有食物快速记；
- Barcode UI；
- legacy Production runtime strangler compatibility。

验证：

```text
unit        10/10 PASS
browser     12/12 PASS
legacy E2E   5/5 PASS
visual       2/2 PASS
AI dry-run       PASS
live OFF         PASS
audit            PASS
```

因此不要重新设计第二套 Nutrition P1，也不要把菜谱、库存、购物、AI 营养教练重新拉回当前 scope。

---

## 3. 本机 consumer / worktree 已完成收口

本机完整回执：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/10#issuecomment-5711408853

继续执行回执：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/10#issuecomment-5711450255

最终状态：

```text
canonical checkout = /Users/zon/Desktop/MINE/html/nutrition-ledger-mvp
canonical consumer = exact origin/test@4e735a0...
worktree count = 1
local branches = 0
reconciliation = MERGED_EQUIVALENT
post-merge sync = SYNCHRONIZED
consumer = CONSUMER_VERIFIED
```

这次严格区分：

```text
SOURCE_SAVED
!= MERGED
!= SEMANTICALLY_RECONCILED
!= TARGET_VERIFIED
!= CONSUMER_UPDATED
```

没有用 `git merge exit 0`、PR merged 或 `worktree_count == 1` 代替最终 consumer readback。

通用治理 owner：

https://github.com/EOMZON/codex-skills-private/issues/29

Nutrition 只作为真实验收案例，不在业务仓复制第二套 Git 治理。

---

## 4. 真实 data / 1-day dogfood 已完成

真实私人 ledger 只读 audit：

```text
pre:
foods=6
observations=21
selections=20
events=22
evidenceRecords=4
intakeRecords=3
intakeEntries=3

post dogfood:
foods=7
observations=30
selections=29
events=31
evidenceRecords=4
intakeRecords=9
intakeEntries=6

ok=true
issues=[]
```

这里只保存 counts / issue codes，不保存私人食物明细、evidence 图片、健康正文或凭据。

真实日用结果：

- 已有食物快速记录约 `3s`；
- 最近食物一键重复约 `2s`；
- 普通首次 Capture 解析 + 写入约 `2s`；
- 条码查询/确认真实使用过；
- 写入后 audit 继续 `ok=true`。

所以 P1 的“低摩擦入口”方向已经获得第一天真实证据，而不再只是 fixture/E2E 推测。

---

## 5. Dogfood 暴露的 P0/P1 语义问题：Issue #19

Issue：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/19

脱敏复现文本：

```text
每100g 能量 539kcal 蛋白质 6.3g 脂肪 30.9g 饱和脂肪 10.6g 碳水化合物 57.5g 糖 56.3g
```

Legacy Capture 正确识别基础营养值，但错误额外产生：

```text
energy_nrv_pct=6.3%
protein_nrv_pct=30.9%
fat_nrv_pct=10.6%
carb_nrv_pct=56.3%
```

这是语义问题，不是结构问题；`audit:data` 仍可能 `ok=true`，因此结构 audit 不能替代 parser semantic tests。

### 已定位根因

`index.html` 的 `parseLabelText()` 中，NRV capture group 采用：

```regex
(?:[^0-9%]*([0-9]+(?:[.,][0-9]+)?)\s*%?)?
```

这里 `%?` 允许百分号缺失，同时 `[^0-9%]*` 可以跨越下一个营养素名称，于是“下一个营养素的数值”被捕获为当前营养素 NRV。

正确 contract：

- NRV 必须出现**明确 `%`** 才能产生；
- 没有 `%` 的相邻数值绝不推断为 NRV；
- 原始 label text 保留用于人工校对；
- 不静默修复/覆盖已经写入的历史 observations。

详细执行 handoff：

https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/nutrition-dogfood-parser-handoff-20260917/docs/handoff/2026-09-17-label-parser-nrv-fix.md

---

## 6. 连续 7-day Gate：Issue #18

Issue：

https://github.com/EOMZON/nutrition-ledger-mvp/issues/18

这条任务不能由一次 AI 会话伪造完成。

同一 canonical ledger 连续 7 个自然日，只记录脱敏统计：

```text
date
captureEvents
repeatEvents
barcodeEvents
aiEstimateEvents
medianSeconds
p90Seconds
manualCorrections
structuralRepairs
silentHistoricalChanges
```

最终 Gate：

- 普通记录至少 80% ≤30s；
- repeat ≤10s；
- silent historical changes = 0；
- imported observation 有 source + method；
- export 可解释；
- structural repair <10%。

---

## 7. 历史 evidence 已安全归档

CreationOS #55 已完成：

https://github.com/EOMZON/creationos-os/issues/55

真实 archive commit：

https://github.com/EOMZON/codex-memory-private/commit/659753dd3d6a0cff91560e7133c8753cd258763d

归档分支：

https://github.com/EOMZON/codex-memory-private/tree/codex/nutrition-archive-20260914

archive-only 是有意状态：材料已经异机可恢复，并不需要为了 Nutrition P1 强行合入 diverged 的 `codex-memory-private/main`。

---

## 8. Product Hub / CreationOS 边界

CreationOS Context Plane：

https://github.com/EOMZON/creationos-os/issues/18

Product Hub presentation：

https://github.com/EOMZON/v0-project-intelligence-hub/issues/2

只投影：

```text
owner
active issue / blocker
verified test SHA
consumer state
latest authoritative evidence
```

不复制：

- Nutrition 私人 ledger；
- 食物/摄入正文；
- evidence 图片；
- parser/runtime 业务状态机。

---

## 9. 发布仍然暂停

CreationOS Ops：

https://github.com/EOMZON/creationos-os/issues/59

当前只有 #18 + #19 收口后，才进入：

```text
real Vercel project-context build
→ test → main authorization
→ Production deploy
→ SSO / alias / deployment exact-SHA readback
```

不要因为 `test`、本机或 dogfood 第一天通过就提前推广 Production。

---

## 10. 当前优先级

```text
P0/P1  #19 parser 语义修复
   ↓
继续 #18 真实 7-day dogfood
   ↓
7 天数据复盘
   ↓
决定是否 release
```

当前不再新增功能路线；任何新想法先等 7-day 使用证据。