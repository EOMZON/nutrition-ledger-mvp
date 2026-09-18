# Nutrition 当前架构 vs 理想架构

日期：2026-09-18 晚间  
状态：docs-only architecture reference，不构成 runtime 变更。

## 0. 当前状态

```text
main = 298cd1f1e46a62d1cd83efca79be73edbadd6c32
test = 244f4c188993e0633833a0b9fd936afedb29605c
canonical consumer = VERIFIED
Day 1 = PASS
Day 2 = PASS
Day 3–7 = PENDING
#28 correction = CANDIDATE_VERIFIED / INTEGRATION_DEFERRED
#26 Coverage = BLOCKED ON #18 + #28
Production = NOT PROMOTED
```

## 1. 当前已实现架构

```mermaid
flowchart TB
    subgraph Input["输入层"]
        Barcode["Barcode"]
        Label["Label / OCR"]
        Manual["Manual"]
        AI["AI Estimate"]
    end

    subgraph Infra["Infrastructure / Adapters"]
        OFF["Open Food Facts Adapter"]
        Normalize["Capture Normalization"]
        Client["Ledger Client"]
    end

    subgraph Domain["Domain"]
        Nutrient["Nutrient Registry"]
        Meal["Meal"]
        Prov["Provenance"]
        History["Intake History"]
    end

    subgraph Ledger["Append-only Ledger"]
        Obs["Observation"]
        Sel["Selection Pointer"]
        Intake["Frozen Intake Snapshot"]
        Evidence["Evidence / Blob"]
    end

    subgraph App["Application"]
        Daily["Daily Experience"]
        Repeat["Recent / Common / Repeat"]
        BarcodeFlow["Barcode Confirm"]
    end

    subgraph Presentation["Presentation"]
        VM["TodayViewModel"]
        Today["Today-first UI"]
        Legacy["Legacy Workbench"]
    end

    Barcode --> OFF --> Obs
    Label --> Normalize --> Obs
    Manual --> Normalize
    AI --> Normalize
    Evidence --> Obs

    Obs --> Sel --> Intake
    Nutrient --> Intake
    Meal --> Intake
    Prov --> Intake
    History --> Daily
    Intake --> Daily
    Client --> Daily
    Daily --> VM
    Repeat --> VM
    BarcodeFlow --> VM
    VM --> Today
    Obs --> Legacy
    Intake --> Legacy
```

## 2. 当前数据流硬规则

```text
raw evidence/provider
→ observation
→ effective selection
→ frozen intake snapshot
→ daily read model
→ Today UI
```

UI 禁止：
- 直接修改历史 observation；
- 从 DOM 推导营养事实；
- 直接拼 provider 结果；
- 把缺失值默认为 0；
- 把 AI estimate 当 verified。

## 3. Correction：从架构缺口推进到 verified candidate

历史 parser bug 暴露的缺口：

```text
observation.add
→ observation.invalidate
→ effective resolver
```

当前已经有 verified Draft candidate：

https://github.com/EOMZON/nutrition-ledger-mvp/pull/29

Candidate：
`60b8dc0fbc7056b6b359f05149c4cf0c71e84fe9`

```mermaid
flowchart LR
    O["observation.add<br/>历史原始值"]
    I["observation.invalidate<br/>reason + evidenceRef"]
    Resolver["Effective Observation Resolver"]
    Selection["Selection State"]
    Export["Export / Audit"]
    History["Frozen Historical Intake"]
    Future["Future Coverage"]

    O --> Resolver
    I --> Resolver
    Resolver --> Selection
    O --> Export
    I --> Export
    O --> History
    Resolver --> Future
```

已验证语义：
- 原始 observation 永久保留；
- invalidation append-only；
- invalidated observation 不参与默认选择；
- selected invalidated 明确返回 unresolved；
- 不静默 fallback；
- History 显示 invalidated + reason；
- frozen historical intake 不回写；
- audit 可发现 dangling invalidation / invalidated selection。

当前仍未：
- merge test；
- 修改真实 private ledger；
- 对真实 3 条 known-invalid NRV 执行 correction。

原因：7-day dogfood 要保持稳定 runtime baseline。

## 4. 理想最终产品架构

```mermaid
flowchart TB
    subgraph Evidence["Evidence / Input"]
        E1["Barcode"]
        E2["Label / OCR"]
        E3["Manual"]
        E4["AI Estimate"]
    end

    subgraph Truth["Evidence-first Truth"]
        O["Observation"]
        Inv["Invalidation / Supersession"]
        S["Effective Selection"]
        I["Frozen Intake Snapshot"]
    end

    subgraph Daily["Daily Domain"]
        Agg["DailyNutrientAggregate"]
        Recent["Recent / Repeat"]
        T["Today"]
    end

    subgraph Target["Target Domain"]
        UserTarget["User-defined Target"]
        RefTarget["User-selected Reference"]
    end

    subgraph Coverage["Decision Layer"]
        CS["CoverageState"]
        Covered["COVERED"]
        Remaining["REMAINING"]
        Unknown["UNKNOWN"]
    end

    subgraph UI["Presentation"]
        Summary["Coverage Summary"]
        Rows["Nutrient Coverage Row"]
        UnknownNotice["Unknown Data Notice"]
        Source["Provenance / Confidence"]
    end

    E1 --> O
    E2 --> O
    E3 --> O
    E4 --> O
    O --> S
    Inv --> S
    S --> I
    I --> Agg
    I --> Recent
    Agg --> T
    UserTarget --> CS
    RefTarget --> CS
    Agg --> CS
    CS --> Covered
    CS --> Remaining
    CS --> Unknown
    Covered --> Summary
    Remaining --> Rows
    Unknown --> UnknownNotice
    CS --> Source
```

核心不变量：

```text
UNKNOWN != 0
UNKNOWN != REMAINING
invalidated observation != deleted history
target change != rewrite historical intake
AI estimate != verified truth
```

## 5. 当前 → 理想差距

| 层 | 当前 | 理想 | 下一 Gate |
|---|---|---|---|
| Capture | 基本完成 | 日用低摩擦 | Day3–7 |
| Provenance | 完成 | 全链可解释 | 继续 dogfood |
| Correction | verified candidate | integrated + real correction | Day7 后 |
| Daily | Day1/2 PASS | 7-day natural use | #18 |
| Coverage | 未实现 | Covered/Remaining/Unknown | #18 + #28 |
| Beta | 未开始 | 5–10 用户 | Coverage 后 |
| Production | 暂停 | 受控上线 | #59 |

## 6. 本地运行身份

```mermaid
flowchart TD
    Code["Canonical Code Checkout"]
    Target["Exact test SHA"]
    Env["Data identity / runtime config"]
    Data["Canonical Private Data Root"]
    Ledger["ledger / state"]
    Blob["blobs / evidence"]
    Backup["Backup / Recovery"]

    Code --> Target
    Target --> Env
    Env --> Data
    Data --> Ledger
    Data --> Blob
    Data --> Backup
```

Canonical：

```text
/Users/zon/Desktop/MINE/html/nutrition-ledger-mvp
```

7-day 期间不移动 private data root。

## 7. Worktree / Merge Synchronization

必须区分：

```text
git worktree count
!= machine-wide clone count
!= consumer freshness
!= private data continuity
```

以及：

```text
SOURCE_SAVED
!= MERGED
!= SEMANTICALLY_RECONCILED
!= TARGET_VERIFIED
!= CONSUMER_UPDATED
```

本轮已经真实证明：只有 PR merged / target CI PASS 不足以证明 canonical consumer 已更新；#24/#25 的 live readback 才完成最终闭环。

参考：
https://github.com/EOMZON/codex-skills-private/issues/29
