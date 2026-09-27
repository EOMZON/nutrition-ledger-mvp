
# 2026-09-28 主线复核：Nutrition 原始目标 → 当前真值 → 理想差距 → 下一步

## 原始目标

XHS 31/31 评论验证的核心诉求：

~~~text
今天吃了什么
→ 自动记录 / 识别
→ 不只看三大宏量
→ 告诉我今天还缺什么
→ 能持续每天使用
~~~

## 当前 Git 真值

~~~text
test = 244f4c188993e0633833a0b9fd936afedb29605c
main = 5fcc8d2b84bc4a02101a46cccf7fb36fde3c496b
fix/nutrition-35-range-parsing = 6b43968fa5a3b3d25bce9a0f0c43c84f6d4e4912
~~~

main 最新提交只是 #33 午餐落盘脚本；test 与 main 已分叉：

~~~text
main ↔ test = DIVERGED
test ahead = 37
main ahead = 1
merge-base = 298cd1f1e46a62d1cd83efca79be73edbadd6c32
~~~

因此 main 不能代表当前 P1 Today 产品版本，也不能代表已发布。

## 9/27–9/28 新进展

### #33 Lunch dogfood

CLOSED / DOGFOOD_PASS。已在 canonical Mac ledger 完成真实 lunch 落盘与 readback。

### #35 Range safety

真实 dogfood 发现：

~~~text
260~510
→ 旧 parseNumeric
→ 260510
~~~

修复 branch：

~~~text
fix/nutrition-35-range-parsing
@ 6b43968fa5a3b3d25bce9a0f0c43c84f6d4e4912
~~~

相对 test：ahead 1 / behind 0。

修复：
- parseNutrientValue 明确 scalar / range / unknown；
- range 不进入 scalar calculation；
- perBasis 保留 min/max 与 provenance；
- 10 regression cases；
- unit 20/20 PASS；
- check PASS。

但是 PR #36 仍 OPEN，test/main 都没有该修复。

### #28 Historical observation correction

仍为：

~~~text
CANDIDATE_VERIFIED
INTEGRATION_DEFERRED
REAL_LEDGER_NOT_MUTATED
~~~

PR #29 仍 Draft。

## 原始目标 → 当前

| 目标 | 当前 | 差距 |
|---|---|---|
| 快速记录今天吃了什么 | 已实现 | 继续稳定 |
| provenance/source | 已实现 | 稳定化 |
| 可修正且不改历史 | candidate + ledger model | #28 integration |
| 连续真实使用 | #33 单次 lunch PASS | #18 仍无完整 7-day receipt |
| 今天还差哪些营养 | 未实现 | #26 |
| Unknown 不等于 0 | contract 已设计 | runtime 未实现 |
| micronutrient 长期价值 | 尚未成为核心 UI | #26 后续 |
| 真实用户 beta | 未形成 | Coverage 后 |
| Production | 未授权/未完成 | #59 |

## 理想架构

~~~mermaid
flowchart TB
    Input[Food or Meal Input] --> Capture[Capture Application]
    Evidence[Photo / Label / Barcode / Source] --> Capture
    Capture --> Candidate[Observation Candidate]
    Candidate --> Review[Human Validation]
    Review --> Observation[Append-only Observation]
    Observation --> Selection[Effective Selection]
    Selection --> Intake[Frozen Intake Snapshot]
    Observation --> Provenance[Provenance]
    Intake --> Daily[Daily Aggregate]
    Target[User Target / Reference] --> Coverage[Coverage Domain]
    Daily --> Coverage
    Coverage --> Covered[COVERED]
    Coverage --> Remaining[REMAINING]
    Coverage --> Unknown[UNKNOWN]
    Daily --> TodayVM[Today ViewModel]
    Coverage --> TodayVM
    Provenance --> TodayVM
    TodayVM --> UI[Today UI]
~~~

硬边界：

~~~text
UI != canonical data
UI != parser
Domain != provider
Domain != database
Observation != Intake
Unknown != 0
Range != Scalar
Target change != historical rewrite
~~~

## 当前 → 理想差距

P0 Data integrity：
~~~text
PR36
→ test integration
→ exact verification
→ canonical consumer readback
~~~

P0 Historical correctness：
~~~text
#28
→ recompare current test
→ merge/reverify
→ backup
→ real 3-observation correction
→ audit
~~~

P0 Product value：
~~~text
#18 true closeout
→ #26 Coverage / Remaining / Unknown
~~~

注意：#33 是一次真实 lunch dogfood，不能冒充 #18 的连续 7-day gate。

P1 Product validation：
~~~text
5–10 real users
→ D1/D3/D7 retention
→ capture time
→ correction rate
→ Unknown rate
→ Coverage interaction
~~~

P2 Infrastructure：
~~~text
Virtual Server
→ Persistence Port
→ Adapter
→ selected provider
→ backup/restore
→ Production
~~~

#34 可以做架构规划，但不应抢占当前产品价值主线。

## 当前唯一主线

~~~text
PR36 range safety
→ #28 correction
→ #18 true 7-day closeout
→ #26 Coverage
→ Beta
→ persistence / release
~~~

## 非目标

- 新建 Nutrition repo
- 直接迁移 D1
- 直接 Production
- AI nutrition coach
- recipes / inventory / community
- 把 micronutrient DB 做成独立大项目
- Product Hub 作为第二业务真源

## 相关 Issues

- 主线：https://github.com/EOMZON/nutrition-ledger-mvp/issues/10
- 7-day：https://github.com/EOMZON/nutrition-ledger-mvp/issues/18
- Coverage：https://github.com/EOMZON/nutrition-ledger-mvp/issues/26
- Correction：https://github.com/EOMZON/nutrition-ledger-mvp/issues/28
- Lunch：https://github.com/EOMZON/nutrition-ledger-mvp/issues/33
- Virtual Server：https://github.com/EOMZON/nutrition-ledger-mvp/issues/34
- Range safety：https://github.com/EOMZON/nutrition-ledger-mvp/issues/35
- Range fix：https://github.com/EOMZON/nutrition-ledger-mvp/pull/36
- Release：https://github.com/EOMZON/creationos-os/issues/59
- Cross-repo audit：https://github.com/EOMZON/product-hub/issues/140
