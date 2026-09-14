# Nutrition data sources and standards research — 2026-09-14

This document is the reusable source-selection baseline for Nutrition Ledger / future Nutrition Workbench.

## Executive decision

Use a **multi-source observation ledger**, never a single food database as truth.

Recommended source order depends on scenario:

### Packaged food

1. user-verified nutrition label
2. OCR label + user confirmation
3. official / manufacturer source when available
4. Open Food Facts barcode lookup
5. manual entry

### Generic ingredient

1. local verified custom value when the user has one
2. official composition database / USDA FoodData Central adapter
3. other database source
4. manual entry

### Cooked meal / restaurant / photo-only meal

1. known recipe with weighed ingredients
2. structured manual estimate
3. multimodal AI estimate

AI/photo estimates must remain explicitly approximate.

---

## Open Food Facts

### Why use it

- barcode lookup is a strong fit for low-friction packaged-food capture;
- API v3 is the current API family for new integrations;
- product endpoint supports selective fields, which keeps calls small;
- many products contain per-100g nutriment fields that map cleanly into the existing ledger.

### Current integration

P0 uses:

`GET https://world.openfoodfacts.org/api/v3/product/{code}`

Requested fields:

- `code`
- `product_name`
- `product_name_zh`
- `product_name_en`
- `brands`
- `brands_tags`
- `nutriments`
- `last_modified_t`
- `last_modified_datetime`

Requests identify this project through a User-Agent.

Official docs:

- https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/

### Nutrition field mapping

| Ledger nutrient | Open Food Facts field | Conversion |
|---|---|---|
| `energy_kcal` | `energy-kcal_100g` | direct |
| `energy_kj` | `energy-kj_100g` | direct |
| `protein_g` | `proteins_100g` | direct |
| `fat_g` | `fat_100g` | direct |
| `carb_g` | `carbohydrates_100g` | direct |
| `sodium_mg` | `sodium_100g` | grams × 1000 |
| `saturated_fat_g` | `saturated-fat_100g` | direct |
| `sugars_g` | `sugars_100g` | direct |
| `fiber_g` | `fiber_100g` | direct |

### Trust model

Open Food Facts is community-maintained. Imported values must therefore be stored as replaceable observations with:

- `source=openfoodfacts`
- `sourceId=off:{barcode}`
- source dataset/version timestamp when available
- `method=database`

Do not silently promote an Open Food Facts value above a user-verified package label.

### License constraints

Official license documentation states:

- database: Open Database License (ODbL)
- individual database contents: Database Contents License
- product images: CC BY-SA, potentially also containing third-party graphical rights

Reference:
https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/

Product decision: P0 consumes specific API results and stores provenance; it does **not** copy the full database or product-image corpus into this repository.

---

## USDA FoodData Central

### Why keep it as an optional P2 adapter

FoodData Central is better suited than a barcode-community database for many generic ingredients and standardized composition records.

Official API guide:
https://fdc.nal.usda.gov/api-guide/

Useful endpoints:

- `/foods/search`
- `/food/{fdcId}`

Current documented operational constraints:

- normal API use requires a data.gov API key;
- default limit: 1,000 requests/hour/IP;
- documentation `DEMO_KEY` has much lower limits;
- FDC data is public domain / CC0;
- USDA requests attribution even though permission is not required.

### Why not P0

The present product failure is not “we lack another database.” It is “daily capture is not yet cheap enough.”

Barcode import + existing label flow already covers the fastest high-value packaged-food path. FDC should be added only after the 7-day daily-use gate shows generic ingredient search is a real bottleneck.

---

## China packaged-food label compatibility

### GB 28050-2025

The new Chinese national nutrition-label standard `GB 28050-2025` is scheduled to take effect on **2027-03-16**.

National Health Commission material:
https://www.nhc.gov.cn/sps/c100087/202509/470fa4ff5de14dd38619223cce9da4e7.shtml

The future mandatory nutrition label expands beyond the old core fields and includes:

- energy
- protein
- fat
- saturated fat
- carbohydrate
- sugars
- sodium
- NRV percentages

### Product impact now

Do not wait until 2027 to change the data model.

The source-normalization layer already recognizes:

- `saturated_fat_g`
- `sugars_g`
- `fiber_g`

The legacy runtime `NUTRIENTS` list still needs a P1 refactor before these extended nutrients appear in Today totals and the main UI.

---

## Provenance contract

Every nutrient value should answer:

1. What food does this value belong to?
2. What nutrient is it?
3. What basis is it measured on (`per-100g`, `per-100ml`, `per-serving`)?
4. What is the source?
5. What source record / barcode / request produced it?
6. What source version/timestamp was used?
7. What method produced it?
8. Is there evidence?
9. If edited, what previous observation is its parent?
10. Which observation did a historical intake actually use?

This is why the append-only ledger should be preserved rather than replaced by a CRUD-style “current nutrition values” table.

## Recommended method vocabulary

High confidence / high priority:

- `label_verified`
- `label_ocr`
- `manual_verified`
- `official_database`

Medium:

- `database`
- `derived`

Explicitly approximate:

- `ai_estimate`

Confidence and method are separate concepts: `ai_estimate` remains approximate even if a model returns a high numerical confidence.

## Privacy rule

Real personal intake data stays local in `data/`, which is already ignored by Git. Repository commits may contain schemas, fixtures and sanitized examples only.
