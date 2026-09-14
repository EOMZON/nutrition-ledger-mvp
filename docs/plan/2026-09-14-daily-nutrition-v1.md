# Daily Nutrition v1 — execution plan and 7-day dogfood gate

Status: P0 implementation started on `codex/nutrition-daily-v1-20260914`.

## Goal

Turn the existing nutrition ledger from a technically credible MVP into a product that can be used for real eating events every day without pretending that uncertain data is precise.

The first milestone is **not** recipe recommendation, weight-loss coaching, meal planning, inventory, or a polished dashboard.

The first milestone is:

> I ate something -> I can capture it quickly -> I know where the numbers came from -> I can correct them -> today's record stays historically stable.

## Current usable paths

### 1. Existing label/OCR-text path

Run the app:

```bash
npm install
npm start
```

Then use the existing `Capture` flow:

`nutrition label text -> parse -> review -> observations -> Today`

Use this when you have package-label text or can copy OCR output from the system/device.

### 2. New barcode path

Dry-run a barcode without writing local data:

```bash
npm run capture:barcode -- --barcode 3017620422003 --dry-run
```

Import a product and add 40g to Today:

```bash
npm run capture:barcode -- \
  --barcode 3017620422003 \
  --grams 40 \
  --meal snack
```

Behavior:

- fetch Open Food Facts v3;
- normalize source fields;
- create/reuse barcode food;
- append nutrition observations;
- avoid identical re-imports by default;
- freeze the current effective values into Today when `--grams` is supplied.

For a production/personal integration, set a contactable User-Agent:

```bash
export NUTRITION_USER_AGENT='NutritionWorkbench/0.2 (your-project-or-contact-url)'
```

### 3. New AI-estimate adapter

This does **not** call a model itself. It accepts a provider-agnostic structured result from any multimodal workflow.

Example file:

```json
{
  "label": "鸡胸肉藜麦沙拉",
  "meal": "lunch",
  "source": "multimodal-provider",
  "model": "model-version",
  "requestId": "trace-id",
  "confidence": 0.68,
  "nutrients": {
    "energy_kcal": 520,
    "protein_g": 38,
    "fat_g": 17,
    "carb_g": 53,
    "sodium_mg": 760,
    "fiber_g": 8
  },
  "note": "estimated from one meal photo"
}
```

Dry run:

```bash
npm run capture:ai -- --file estimate.json --dry-run
```

Write to the ledger and Today:

```bash
npm run capture:ai -- --file estimate.json
```

The values are permanently marked `method=ai_estimate`.

### 4. Data integrity audit

```bash
npm run audit:data
```

It currently checks:

- invalid JSON / JSONL;
- duplicate food/observation/intake IDs;
- observations referencing missing foods;
- observations referencing missing evidence;
- observations without source/method provenance;
- selections referencing missing observations;
- intake snapshots referencing missing observations;
- intake patch/void events without a base intake.

## 7-day dogfood protocol

For 7 consecutive real-use days, capture actual eating events with the same local dataset.

Do not optimize for completeness. Optimize for friction and truthfulness.

### For each eating event

Choose the cheapest valid route:

1. already-known food -> use existing Today Quick Add;
2. packaged food with barcode -> `capture:barcode`;
3. package label but database value looks wrong/missing -> label/OCR flow and verify;
4. cooked meal/photo-only -> structured `capture:ai` estimate;
5. anything else -> manual fallback.

Record friction only when it is meaningful. A short note is enough:

- `slow:first-setup`
- `slow:repeat`
- `wrong:database`
- `wrong:portion`
- `missing:food`
- `missing:nutrient`
- `ui:too-many-steps`

### End of each day

Run:

```bash
npm run audit:data
```

Then check Today:

- are there missing meals?
- did any values lose provenance?
- did a corrected default silently rewrite old intake? (it must not)
- which capture path caused the most friction?

### Gate after day 7

P0 passes only if:

- at least 80% of eating events can be captured in <=30 seconds after first-time food setup;
- repeat foods can be captured in <=10 seconds;
- no historical intake changes silently after food-default edits;
- every imported observation has `source` and `method`;
- export remains usable as backup;
- fewer than 10% of records need structural repair (ordinary nutrition-value correction is not structural repair).

## Priority backlog

### P0 — current branch

- [x] canonical repository decision
- [x] source normalization layer separated from ledger API
- [x] Open Food Facts v3 barcode adapter
- [x] duplicate-import guard
- [x] provider-agnostic AI estimate adapter
- [x] extended nutrient normalization: saturated fat / sugars / fiber
- [x] ledger integrity audit
- [x] unit-test coverage for normalizers/dedup logic
- [ ] run unit + existing Playwright E2E in a networked/local checkout
- [ ] run the first real barcode capture against local data
- [ ] run the first real AI/photo structured estimate against local data
- [ ] push the 2026-09-14 `codex-memory-private` evidence commit so canonical history is remotely addressable

### P1 — after first dogfood evidence

- Today becomes the default/primary view;
- first-class `meal` on intake records instead of encoding it in notes;
- recent/favorite food shortcuts and one-tap repeat;
- source + confidence badge in Today and food details;
- extend runtime nutrient registry with saturated fat, sugars and fiber;
- expose barcode import in UI/mobile camera rather than CLI only;
- split monolithic `index.html` and `server.mjs` into domain/data/UI modules without changing ledger semantics;
- create regression tests for immutable-history behavior.

### P2 — only after P1 friction data

- direct photo -> multimodal structured estimate;
- label photo -> OCR/vision -> correction UI;
- USDA FoodData Central generic ingredient search adapter;
- optional sync/backup across devices;
- offline-first mobile capture shell.

### P3 — deliberately deferred

- nutrient goals and trend coaching;
- recipe recommendation;
- meal planning;
- inventory / expiry linkage;
- shopping list;
- content-creation workflows from the historic NutriFlow concept.

## Repository governance

- executable mainline: `nutrition-ledger-mvp`
- historic requirements: `NutriLogWX`
- future-product vision/reference: `NutriFlow`
- broader medical/physical-exam product: `health-workbench` (stay separate)
- evidence/history archive: `codex-memory-private`

Do not open another nutrition implementation repository during P0/P1.

If the product passes the 7-day gate, then evaluate a repository/product rename to `nutrition-workbench` as a governance action, not as a rewrite.
