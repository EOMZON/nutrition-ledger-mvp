# Daily Nutrition v1 — layered architecture

Date: 2026-09-14  
Status: accepted incremental architecture for `nutrition-ledger-mvp`  
Task branch: `codex/nutrition-daily-v1-20260914`

## 1. Goal

Keep the proven append-only ledger semantics while migrating the product away from a monolithic `server.mjs + index.html` implementation.

This is a **strangler migration**, not a rewrite.

The product must remain able to answer four different questions without mixing them:

1. What is a nutrient / meal / provenance rule? → **domain**
2. How does a user capture or transform nutrition information? → **application**
3. How do we talk to Open Food Facts / the ledger HTTP API / future providers? → **infrastructure**
4. What shape does the UI need to render Today? → **presentation**

## 2. Current target structure

```text
src/
  domain/
    nutrients.mjs
    meals.mjs
    provenance.mjs

  application/
    capture-normalization.mjs

  infrastructure/
    ledger-client.mjs
    open-food-facts.mjs

  presentation/
    today-view-model.mjs

lib/
  ledger-client.mjs          # compatibility shim only
  nutrition-normalize.mjs    # compatibility shim only

tools/
  capture-barcode.mjs
  capture-ai-estimate.mjs
  view-today.mjs
  audit-ledger.mjs

server.mjs                   # legacy runtime shell; migrate incrementally
index.html                   # legacy UI shell; migrate incrementally
```

## 3. Dependency rule

Allowed dependency direction:

```text
presentation ───────┐
application ────────┼──> domain
infrastructure ─────┘

tools -> application + infrastructure + presentation
legacy server -> domain/application/infrastructure (future migration)
legacy UI -> presentation (next migration slice)
```

Forbidden:

- `domain` importing HTTP, filesystem, DOM, browser globals, Open Food Facts, or UI code;
- `application` reading/writing JSONL directly;
- `presentation` calling remote food APIs directly;
- UI components deciding provenance precedence themselves;
- Open Food Facts adapter deciding how Today should render;
- new code directly mutating historical intake records.

## 4. Single sources of truth

### Nutrient registry

Canonical new-code registry:

`src/domain/nutrients.mjs`

It contains:

- nutrient IDs;
- labels;
- units;
- capture eligibility;
- extended nutrients for the new nutrition-label direction.

Do not create another nutrient enum in React/components/tools.

The old `server.mjs` registry remains a migration debt until the server slice is safely migrated and regression-tested.

### Meal semantics

Canonical new-code meal handling:

`src/domain/meals.mjs`

Today still stores meal as `meal:<value>` in `note` for backward compatibility because the legacy server does not yet persist a first-class `meal` field.

P1 migration should add `meal` to the intake schema while continuing to read the old note encoding.

### Provenance precedence

Canonical new-code precedence:

`src/domain/provenance.mjs`

Current order, high to low:

1. `label_verified`
2. `label_ocr`
3. `manual_verified`
4. `manual`
5. `official_database`
6. `database`
7. `derived`
8. `ai_estimate`

No UI is allowed to silently promote `ai_estimate` to verified data.

## 5. Capture architecture

### Packaged food

```text
barcode
  -> infrastructure/open-food-facts
  -> parse provider payload
  -> normalized capture result
  -> application/toObservationPayloads
  -> infrastructure/ledger-client
  -> append observations
  -> optional Today intake
```

Provider-specific field names stop at the infrastructure boundary.

### AI meal estimate

```text
provider/model output JSON
  -> application/normalizeAiEstimate
  -> normalized capture result
  -> observation payloads with method=ai_estimate
  -> ledger
  -> Today intake
```

Model-specific APIs are deliberately not part of the domain layer.

## 6. UI/data separation

The next UI must not receive the raw ledger payload and then perform business interpretation inside components.

Instead:

```text
GET /api/today
  -> createTodayViewModel(rawToday)
  -> UI components
```

`src/presentation/today-view-model.mjs` currently produces:

- date;
- total kcal / protein / fat / carbohydrate summary;
- entries grouped by meal;
- amount label;
- provenance method/source labels;
- explicit `approximate` state;
- total count of approximate entries.

This lets the final UI stay intentionally dumb:

```text
TodayPage
  SummaryStrip
  MealSection[]
    IntakeRow[]
      SourceBadge
      MacroSummary
```

The component tree renders state. It must not infer source trust or recalculate nutrient totals.

## 7. Compatibility policy

`lib/ledger-client.mjs` and `lib/nutrition-normalize.mjs` are compatibility shims.

They re-export canonical modules from `src/` so existing scripts/imports do not fail during migration.

Do not add new implementation logic to `lib/`.

When all callers have moved to `src/`, remove the shims in a separately tested cleanup change.

## 8. Legacy shell policy

### `server.mjs`

Do not split it in one change.

Recommended order:

1. import canonical nutrient/provenance helpers;
2. add first-class `meal` and structured `confidence` fields without breaking old data;
3. extract ledger file-store functions;
4. extract HTTP route handlers;
5. leave a thin composition root in `server.mjs`.

Each step must keep existing E2E behavior green.

### `index.html`

Do not replace it with React merely for architecture aesthetics.

Recommended order:

1. make Today the default landing surface;
2. wire `TodayViewModel` concepts into the current UI;
3. split render functions / event bindings from data fetch;
4. only then decide whether a React shell materially improves maintenance.

The migration criterion is lower coupling and lower daily friction, not framework count.

## 9. Testing strategy

### Pure unit layer

No network/browser required:

```bash
npm run test:unit
```

Current architecture slice covers:

- barcode normalization;
- Open Food Facts parsing;
- Open Food Facts HTTP adapter via injected fake fetch;
- AI estimate normalization/provenance;
- observation duplicate filtering;
- Today read-model grouping and approximate-data state.

### Legacy integration/browser layer

```bash
npm run test:e2e
```

This remains required before integration into `test` because the old page/server are still the production runtime.

### Personal data integrity

```bash
npm run audit:data
```

Run against the user's real local data only. Personal nutrition ledger data must stay out of Git.

## 10. Next architecture slices

### P1-A — server domain adoption

- import shared nutrient definitions / provenance priority;
- preserve old JSONL compatibility;
- add tests before deleting old constants.

### P1-B — first-class intake metadata

- persist `meal` separately;
- persist structured confidence/provenance where appropriate;
- keep note-based read compatibility.

### P1-C — Today UI adapter

- make Today primary entry;
- UI reads a view-model, not provider/ledger internals;
- recent/repeat food actions remain application commands, not UI state hacks.

### P1-D — UI components

Minimum component boundaries:

```text
TodayPage
  TodaySummary
  CaptureActions
  MealSection
  IntakeRow
  ProvenanceBadge
  QuickRepeatAction
```

Keep components data-driven; do not place ledger parsing inside them.

## 11. Explicitly deferred

Do not add these until the 7-day daily-use gate creates evidence they are needed:

- recipe recommendation;
- kitchen inventory;
- shopping lists;
- creator/content workflows;
- weight-loss coaching;
- generalized health diagnosis;
- cross-device sync architecture.

## 12. Acceptance rule

A refactor is accepted only when it either:

- removes duplicated business semantics;
- isolates an external dependency;
- makes a behavior independently testable;
- reduces UI knowledge of data/storage details;
- or shortens the real daily-use flow.

File movement alone is not architecture progress.
