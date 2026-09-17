import test from "node:test";
import assert from "node:assert/strict";
import {
  computeCurrentNutritionSnapshot,
  confirmBarcodeCandidate,
  createDailyIntake,
} from "../src/application/daily-experience.mjs";
import { deriveFoodShortcuts, mergeIntakeRecords } from "../src/domain/intake-history.mjs";

function observation(nutrientId, value, unit = "g", extra = {}) {
  return {
    id: `obs:${nutrientId}`,
    nutrientId,
    value,
    unit,
    basis: { kind: "per-100g" },
    method: extra.method || "database",
    source: extra.source || "fixture",
    sourceId: extra.sourceId || "fixture:1",
    datasetVersion: extra.datasetVersion || "v1",
    evidenceId: "",
  };
}

function foodView(observations) {
  return {
    food: { id: "food:test", label: "测试食物" },
    observations,
    effective: Object.fromEntries(
      observations.map((item) => [
        `food:test|${item.nutrientId}|per-100g`,
        { observation: item, selection: null },
      ]),
    ),
  };
}

test("extended nutrition snapshot uses the domain nutrient registry", () => {
  const view = foodView([
    observation("energy_kcal", 200, "kcal"),
    observation("protein_g", 10),
    observation("saturated_fat_g", 4),
    observation("sugars_g", 12),
    observation("fiber_g", 8),
    observation("sodium_mg", 300, "mg"),
  ]);

  const snapshot = computeCurrentNutritionSnapshot(
    view,
    { quantity: 50, unit: "g" },
    { kind: "per-100g" },
  );

  assert.equal(snapshot.computed.energy_kcal.value, 100);
  assert.equal(snapshot.computed.saturated_fat_g.value, 2);
  assert.equal(snapshot.computed.sugars_g.value, 6);
  assert.equal(snapshot.computed.fiber_g.value, 4);
  assert.equal(snapshot.computed.sodium_mg.value, 150);
});

test("daily intake stores first-class meal while preserving append-only legacy APIs", async () => {
  const calls = { created: null, patch: null };
  const view = foodView([
    observation("energy_kcal", 200, "kcal", { method: "ai_estimate", source: "fixture-ai" }),
    observation("protein_g", 10, "g", { method: "ai_estimate", source: "fixture-ai" }),
    observation("fiber_g", 8, "g", { method: "ai_estimate", source: "fixture-ai" }),
  ]);
  const gateway = {
    async getFood() { return view; },
    async createIntake(payload) {
      calls.created = payload;
      return { intake: { id: "in:test", ...payload, computed: {}, perBasis: {} } };
    },
    async patchIntake(intakeId, patch, reason) {
      calls.patch = { intakeId, patch, reason };
      return { intake: { id: intakeId, ...calls.created, ...patch } };
    },
  };

  const intake = await createDailyIntake(gateway, {
    foodId: "food:test",
    amount: { quantity: 50 },
    meal: "lunch",
    note: "训练后",
  });

  assert.equal(calls.created.note, "meal:lunch | 训练后");
  assert.equal(calls.patch.patch.meal, "lunch");
  assert.equal(calls.patch.reason, "daily_experience_create");
  assert.equal(intake.computed.fiber_g.value, 4);
});

test("intake history merges patches/voids and derives recent/common shortcuts", () => {
  const records = [
    {
      type: "intake.add",
      id: "in:1",
      foodId: "food:a",
      foodLabel: "燕麦",
      consumedAt: "2026-09-16T01:00:00Z",
      amount: { quantity: 40, unit: "g" },
      basis: { kind: "per-100g" },
      note: "meal:breakfast",
    },
    {
      type: "intake.add",
      id: "in:2",
      foodId: "food:a",
      foodLabel: "燕麦",
      consumedAt: "2026-09-17T01:00:00Z",
      amount: { quantity: 50, unit: "g" },
      basis: { kind: "per-100g" },
      meal: "breakfast",
    },
    {
      type: "intake.patch",
      id: "in:2",
      patch: { meal: "lunch" },
      createdAt: "2026-09-17T01:05:00Z",
    },
    {
      type: "intake.add",
      id: "in:3",
      foodId: "food:b",
      foodLabel: "酸奶",
      consumedAt: "2026-09-17T02:00:00Z",
      amount: { quantity: 100, unit: "g" },
      basis: { kind: "per-100g" },
      meal: "snack",
    },
    { type: "intake.void", id: "in:3", createdAt: "2026-09-17T02:10:00Z" },
  ];

  const merged = mergeIntakeRecords(records);
  assert.equal(merged["in:2"].meal, "lunch");
  assert.ok(merged["in:3"].voidedAt);

  const shortcuts = deriveFoodShortcuts(
    records,
    [{ id: "food:a", label: "燕麦" }, { id: "food:b", label: "酸奶" }],
    { now: new Date("2026-09-17T10:00:00Z") },
  );
  assert.equal(shortcuts.recent.length, 1);
  assert.equal(shortcuts.recent[0].foodId, "food:a");
  assert.equal(shortcuts.recent[0].meal, "lunch");
  assert.equal(shortcuts.common[0].count, 2);
});

test("barcode confirmation skips an identical imported observation", async () => {
  const existingEnergy = observation("energy_kcal", 539, "kcal", {
    source: "openfoodfacts",
    sourceId: "off:3017620422003",
    datasetVersion: "123",
  });
  const captured = [];
  const gateway = {
    async createFood(food) { return { food: { id: "food:test", ...food } }; },
    async getFood() { return { observations: [existingEnergy], effective: {} }; },
    async createObservations(items) { captured.push(...items); return { observations: items }; },
  };
  const fetchImpl = async () => ({
    status: 200,
    ok: true,
    async json() {
      return {
        product: {
          code: "3017620422003",
          product_name: "Nutella",
          brands: "Ferrero",
          last_modified_t: "123",
          nutriments: {
            "energy-kcal_100g": 539,
            "proteins_100g": 6.3,
          },
        },
      };
    },
  });

  const result = await confirmBarcodeCandidate(
    gateway,
    { barcode: "3017620422003", addToday: false },
    { fetchImpl },
  );

  assert.equal(result.skippedDuplicateObservations, 1);
  assert.equal(result.importedObservations, 1);
  assert.equal(captured[0].nutrientId, "protein_g");
});
