# Nutrition system canonical decision — 2026-09-14

## Decision

Use **`EOMZON/nutrition-ledger-mvp` as the executable canonical repository** for the next nutrition product iteration.

Do **not** restart from `NutriFlow`, `NutriLogWX`, or the broader `health-workbench`.

Working product name may evolve to **Nutrition Workbench**, but repository migration/rename is intentionally deferred until the daily-use loop is proven. Avoid a rename-only project before product proof.

## Why this repository wins

`nutrition-ledger-mvp` is the only inspected remote repository that already has all of the following together:

- a local-first runnable server;
- immutable JSONL observations/events/evidence/intakes;
- source selection and rollback instead of destructive overwrite;
- explicit food defaults vs. Today intake snapshots;
- label/OCR text parsing and user correction;
- evidence image support;
- export;
- Playwright E2E covering create food -> import label -> edit -> rollback -> Today.

That foundation is closer to a durable daily product than a visually richer prototype with simulated data.

## Source-repository disposition

| Repository / line | Current value | Decision |
|---|---|---|
| `nutrition-ledger-mvp` | Working immutable ledger, Today flow, evidence, E2E | **Canonical executable mainline** |
| `NutriLogWX` | Historic WeChat mini-program requirements + skeleton | Freeze as **requirements/history source**; migrate useful requirements only |
| `NutriFlow` | Broad kitchen/meal/content vision; archived; prototype-oriented | Freeze as **future product vision/reference**, not implementation base |
| `nutrition-mvp` | Historic photo -> AI rough estimate -> replay proof | Treat as **capability evidence**; migrate the capture semantics, not the old code blindly |
| `nutrition-workbench` | Previously identified as preferred future direction but no accessible remote repository was found during this audit | Treat as **product naming/architecture direction**, not a second codebase |
| `health-workbench` | Real health-exam evidence visualization, private health data, separate domain model | Keep separate. Nutrition may export summaries to it later, but must not be embedded into it now |
| `codex-memory-private` | Canonical historical evidence store | Keep evidence dossier there; link back from this repo when the 2026-09-14 local commit is pushed |

## Important evidence-sync finding

The user supplied a local `codex-memory-private` commit reference `659753d` containing the nutrition evidence dossier and handoff material. During this audit, that commit was **not present on GitHub remote**; the visible remote history was older.

Therefore:

- do not claim the 2026-09-14 dossier is remotely archived until that local commit is pushed;
- this repository contains the executable decision and forward plan so product progress is not blocked;
- after the local evidence commit is pushed, add permanent GitHub links here.

## Product definition: Daily Nutrition v1

The goal is not a perfect diet database. The goal is a system that is trustworthy enough and cheap enough to use every day.

### Primary loop

1. **Capture** something eaten.
2. Resolve nutrition through the best available source.
3. Make uncertainty and provenance visible.
4. Allow a quick correction.
5. Freeze the resolved values into the Today intake record.
6. Review the day and reuse foods without repeating work.

### Two capture lanes must stay separate

#### Lane A — packaged food / nutrition label

Priority order:

1. user-verified label value;
2. OCR from label + user confirmation;
3. trusted/known database value;
4. community database value;
5. manual fallback.

This lane can aim for relatively high precision because the package contains declared values.

#### Lane B — cooked meal / photo estimate

A meal photo estimate is intrinsically uncertain because portion size, hidden oil/sauces and ingredients are not fully observable.

Requirements:

- store it as `method=ai_estimate`, never disguise it as a verified label;
- store confidence/notes and source metadata;
- make correction one step away;
- freezing the estimate into Today is allowed, but later corrections must not silently rewrite history;
- user may explicitly recalc an intake from newer defaults.

## Data-source strategy

### Open Food Facts

Use primarily for barcode/product lookup. Current API documentation recommends API v3 for new integrations. Data is community supplied, so it must remain a replaceable observation, not the system's final truth.

Reference:
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/

License note: database data is ODbL; product images have separate CC BY-SA terms. Do not casually copy their full database or imagery into a differently licensed product without complying with those terms.

### USDA FoodData Central

Use as an optional source for generic ingredients / food composition, particularly when no reliable package barcode value exists. FDC API data is CC0/public-domain, requires an API key for normal usage, and currently documents a default limit of 1,000 requests/hour/IP.

Reference:
- https://fdc.nal.usda.gov/api-guide/
- https://fdc.nal.usda.gov/data-documentation/

### China nutrition-label compatibility

`GB 28050-2025` was published in 2025 and is scheduled to take effect on **2027-03-16**. The new mandatory label set includes energy, protein, fat, saturated fat, carbohydrate, sugars and sodium plus NRV percentages.

The current runtime model only exposes energy/protein/fat/carbohydrate/sodium. Daily Nutrition v1 should therefore make the domain model extensible now and add at least:

- `saturated_fat_g`
- `sugars_g`
- `fiber_g` (useful even when not mandatory)

Reference:
- https://www.nhc.gov.cn/sps/c100087/202509/470fa4ff5de14dd38619223cce9da4e7.shtml

## Source/provenance policy

Never overwrite a nutrient value in place. Every imported or edited value is a new observation.

Recommended method precedence (high -> low):

1. `label_verified`
2. `label_ocr`
3. `manual_verified`
4. `official_database`
5. `database`
6. `derived`
7. `ai_estimate`

The current runtime has a smaller ranking set. Extending the ranking safely is a P1 server refactor; until then, new tools preserve the more specific method names in records even when the old UI does not rank all of them.

## Priorities

### P0 — make the existing product usable every day

- barcode -> Open Food Facts -> normalize -> import to current ledger;
- optional immediate add to Today;
- AI-estimate JSON -> ledger -> Today adapter, provider-agnostic;
- ledger integrity audit command;
- no real nutrition records committed to Git;
- document a 7-day dogfood protocol.

### P1 — productize the daily loop

- make Today the default landing surface;
- meal grouping (breakfast/lunch/dinner/snack) as first-class data, not notes;
- recent/favorite foods and one-tap repeat;
- explicit confidence/source badge;
- add saturated fat/sugars/fiber to runtime nutrient registry;
- migrate monolithic HTML/server toward domain/data/UI separation without rewriting the ledger.

### P2 — photo capture and external services

- direct image -> multimodal model estimate;
- label-image OCR provider integration;
- optional FDC search adapter;
- mobile camera/barcode capture;
- sync/backup only after the local loop is stable.

### P3 — planning/recommendation

- targets and trend review;
- recipes/meal plans;
- inventory linkage;
- recommendations.

Do not pull the broad NutriFlow kitchen/content system into P0/P1.

## Success gate before any repo rename or major rewrite

Run the same canonical codebase for at least 7 real days and confirm:

- >= 80% of eating events can be logged in <= 30 seconds after first-time food setup;
- repeat foods take <= 10 seconds;
- no intake history changes silently after a default nutrient value is edited;
- every imported value exposes a source/method;
- the user can export/backup the ledger;
- fewer than 1 in 10 records require structural repair (not ordinary value correction).

Only after this gate should we decide whether to rename the repository to `nutrition-workbench`.