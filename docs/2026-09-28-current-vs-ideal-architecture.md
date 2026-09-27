
# 2026-09-28 Nutrition 当前 vs 理想架构

## 当前真实链路

~~~mermaid
flowchart TB
    Input[Food / Meal Input] --> Capture[Capture]
    Evidence[Evidence] --> Capture
    Capture --> Observation[Observation]
    Observation --> Selection[Effective Selection]
    Selection --> Intake[Frozen Intake]
    Intake --> Daily[Daily Aggregate]
    Daily --> TodayVM[Today ViewModel]
    TodayVM --> UI[Today UI]
    Observation --> Provenance[Provenance]
    Provenance --> TodayVM
~~~

## 理想产品链路

~~~mermaid
flowchart TB
    Source[Food / Label / Barcode / Photo] --> Candidate[Candidate]
    Candidate --> Review[Human Review]
    Review --> Observation[Append-only Observation]
    Observation --> Selection[Effective Selection]
    Selection --> Intake[Frozen Intake]
    Intake --> Daily[Daily Aggregate]
    Target[User Target / Reference] --> Coverage[Coverage]
    Daily --> Coverage
    Coverage --> Covered[COVERED]
    Coverage --> Remaining[REMAINING]
    Coverage --> Unknown[UNKNOWN]
    Coverage --> Today[Today ViewModel]
    Provenance[Evidence / Provenance / Confidence] --> Today
    Today --> UI[Today UI]
~~~

## 数据 / UI / 基础设施边界

~~~text
Source / Provider
→ Application
→ Domain
→ Persistence Port
→ Persistence Adapter
→ Store

Domain
→ Projection / ViewModel
→ UI

Evidence
→ Provenance
→ UI explanation

UI 不直接解释 range；
UI 不直接改 ledger；
Domain 不依赖具体数据库；
Provider 不直接修改 graph/read model。
~~~

## 当前缺口

1. #35 range safety 尚未进入 test。
2. #28 historical correction 尚未进入 test / real ledger。
3. #18 7-day evidence 没有完整收口。
4. #26 Coverage 未实现。
5. Virtual Server / persistence adapter 仍是未来阶段。
6. Production 未完成 exact-SHA consumer gate。

## 关键不变量

~~~text
range != scalar
unknown != zero
observation != intake
invalidated observation != deleted history
target != historical truth
domain != database
ui != persistence
~~~
