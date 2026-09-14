import test from "node:test";
import assert from "node:assert/strict";
import { filterNewObservations } from "../lib/ledger-client.mjs";
import {
  normalizeAiEstimate,
  normalizeBarcode,
  parseOpenFoodFactsPayload,
  toObservationPayloads,
} from "../lib/nutrition-normalize.mjs";

test("normalizeBarcode strips non-digits", () => {
  assert.equal(normalizeBarcode(" 690-123 456 "), "690123456");
});

test("Open Food Facts payload becomes traceable per-100g observations", () => {
  const normalized = parseOpenFoodFactsPayload(
    {
      product: {
        code: "6901234567890",
        product_name_zh: "测试燕麦杯",
        product_name: "Oat cup",
        brands: "Demo Brand",
        last_modified_t: 1780000000,
        nutriments: {
          "energy-kcal_100g": 420,
          "energy-kj_100g": 1757,
          proteins_100g: 12.5,
          fat_100g: 9.2,
          carbohydrates_100g: 61,
          sodium_100g: 0.32,
          "saturated-fat_100g": 2.1,
          sugars_100g: 8.4,
          fiber_100g: 7.3,
        },
      },
    },
    "6901234567890",
  );

  assert.equal(normalized.food.label, "测试燕麦杯");
  assert.equal(normalized.food.brand, "Demo Brand");
  assert.deepEqual(normalized.basis, { kind: "per-100g" });
  assert.equal(normalized.source.name, "openfoodfacts");
  assert.equal(normalized.source.method, "database");
  assert.equal(normalized.nutrients.find((item) => item.nutrientId === "sodium_mg").value, 320);
  assert.equal(normalized.nutrients.find((item) => item.nutrientId === "sugars_g").value, 8.4);

  const observations = toObservationPayloads("food:barcode:6901234567890", normalized);
  assert.equal(observations.length, 9);
  assert.equal(observations[0].sourceId, "off:6901234567890");
  assert.equal(observations[0].basis.kind, "per-100g");
  assert.match(observations[0].note, /sourceConfidence=community_database/);
});

test("AI estimate remains explicitly approximate and per-serving", () => {
  const normalized = normalizeAiEstimate({
    label: "鸡胸藜麦沙拉",
    meal: "lunch",
    provider: "example-provider",
    model: "vision-model-v1",
    confidence: 0.68,
    nutrients: {
      energy_kcal: 520,
      protein_g: 38,
      fat_g: 17,
      carb_g: 53,
      sodium_mg: 760,
      fiber_g: 8,
    },
  });

  assert.equal(normalized.source.method, "ai_estimate");
  assert.equal(normalized.source.confidence, 0.68);
  assert.equal(normalized.basis.kind, "per-serving");
  assert.deepEqual(normalized.amount, { quantity: 1, unit: "serving" });
  assert.equal(normalized.meal, "lunch");
  assert.match(normalized.note, /AI meal estimate/);

  const observations = toObservationPayloads("food:custom:test", normalized);
  assert.match(observations[0].note, /sourceConfidence=0.68/);
});

test("duplicate source/value observations are skipped", () => {
  const payloads = [
    {
      nutrientId: "protein_g",
      source: "openfoodfacts",
      sourceId: "off:1",
      datasetVersion: "v1",
      value: 10,
      unit: "g",
      basis: { kind: "per-100g" },
    },
    {
      nutrientId: "fat_g",
      source: "openfoodfacts",
      sourceId: "off:1",
      datasetVersion: "v1",
      value: 5,
      unit: "g",
      basis: { kind: "per-100g" },
    },
  ];

  const view = {
    observations: [
      {
        ...payloads[0],
        value: "10",
      },
    ],
  };

  const pending = filterNewObservations(view, payloads);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].nutrientId, "fat_g");
});
