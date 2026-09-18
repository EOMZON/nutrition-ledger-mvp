# Observation invalidation / supersession candidate

日期：2026-09-18  
Issue：https://github.com/EOMZON/nutrition-ledger-mvp/issues/28  
基线：`test@244f4c188993e0633833a0b9fd936afedb29605c`

## 目标

为 append-only observation ledger 增加最小 correction 语义：

```text
observation.add
→ observation.invalidate
→ effective resolver
```

原始 observation 永不删除、永不覆盖。

## Candidate contract

```json
{
  "type": "observation.invalidate",
  "id": "evt_*",
  "observationId": "obs_*",
  "foodId": "food:*",
  "nutrientId": "protein_nrv_pct",
  "basisKey": "per-100g",
  "reason": "parser_bug",
  "evidenceRef": "issue:19",
  "createdAt": "...",
  "createdBy": "user:local"
}
```

## Resolver semantics

### selected active
继续使用 selected observation。

### no selection
只从 active observations 中按既有 source/method priority 选择默认值。

### selected invalidated
**禁止静默 fallback。**

返回：

```text
status = selected_invalidated
observation = null
```

由 UI/调用方明确提示用户重新选择有效来源。

这样避免 correction 后系统悄悄换成另一个数值。

## Frozen history

已写入 intake snapshot 的历史不回写。

```text
observation invalidated today
!= rewrite yesterday intake
```

历史 intake 仍保留当时使用的 observationId，符合“历史为什么这样算”的审计要求。

## Audit semantics

fatal issue：
- invalidation 指向不存在的 observation。

warning：
- selection 仍指向 invalidated observation。

历史 intake snapshot 指向后来被 invalidated 的 observation 不视为结构错误，因为 frozen snapshot 是历史事实。

## UI semantics

History 中：
- invalidated observation 保留显示；
- 显示 invalidated badge + reason；
- 禁止“使用此值”；
- 如果当前 selection 指向 invalidated observation，当前有效值显示 unresolved，而不是自动选择别的值。

## Safety boundary

本 candidate：
- 使用 sanitized fixture；
- 不读取/修改真实 private ledger；
- 不 merge test；
- 不 test→main；
- 不 deploy Production。

真实 3 条错误 NRV 的执行必须另做本机 readback/receipt，并在执行前明确 observation IDs 与 backup/recovery 证据。
