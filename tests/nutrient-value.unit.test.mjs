import test from "node:test";
import assert from "node:assert/strict";
import { parseNutrientValue } from "../src/domain/nutrients.mjs";
import {
  parseNumeric,
  parseNutrientValue as serverParseNutrientValue,
  computeIntakeSnapshot,
} from "../server.mjs";

// nutrition-ledger-mvp#35: 区间估值不得被压平成伪单值。

test("parseNutrientValue: 260~510 is a range, not 260510", () => {
  assert.deepEqual(parseNutrientValue("260~510"), { kind: "range", min: 260, max: 510 });
});

test("parseNutrientValue: hyphen / spaced / en-dash ranges", () => {
  assert.deepEqual(parseNutrientValue("260 - 510"), { kind: "range", min: 260, max: 510 });
  assert.deepEqual(parseNutrientValue("260-510"), { kind: "range", min: 260, max: 510 });
  assert.deepEqual(parseNutrientValue("260–510"), { kind: "range", min: 260, max: 510 });
  assert.deepEqual(parseNutrientValue("260 — 510"), { kind: "range", min: 260, max: 510 });
});

test("parseNutrientValue: single values stay scalar", () => {
  assert.deepEqual(parseNutrientValue("260"), { kind: "scalar", value: 260 });
  assert.deepEqual(parseNutrientValue("260.5"), { kind: "scalar", value: 260.5 });
  assert.deepEqual(parseNutrientValue(260), { kind: "scalar", value: 260 });
  assert.deepEqual(parseNutrientValue("260 kcal"), { kind: "scalar", value: 260 });
  assert.deepEqual(parseNutrientValue("约260"), { kind: "scalar", value: 260 });
  assert.deepEqual(parseNutrientValue("1,200"), { kind: "scalar", value: 1200 });
  assert.deepEqual(parseNutrientValue("-5"), { kind: "scalar", value: -5 });
});

test("parseNutrientValue: garbage is unknown, never concatenated", () => {
  assert.deepEqual(parseNutrientValue(""), { kind: "unknown" });
  assert.deepEqual(parseNutrientValue("abc"), { kind: "unknown" });
  assert.deepEqual(parseNutrientValue("1-2-3"), { kind: "unknown" });
});

test("parseNumeric (server.mjs): range inputs return null", () => {
  assert.equal(parseNumeric("260~510"), null);
  assert.equal(parseNumeric("260 - 510"), null);
  assert.equal(parseNumeric("260–510"), null);
  assert.equal(parseNumeric("260-510"), null);
});

test("parseNumeric (server.mjs): scalar inputs unchanged", () => {
  assert.equal(parseNumeric("260"), 260);
  assert.equal(parseNumeric("260.5"), 260.5);
  assert.equal(parseNumeric("1,200"), 1200);
  assert.equal(parseNumeric("260 kcal"), 260);
  assert.equal(parseNumeric(260), 260);
});

test("server re-exports the domain classifier", () => {
  assert.equal(serverParseNutrientValue, parseNutrientValue);
});

function rangeObservation(overrides = {}) {
  return {
    id: "o-range-1",
    foodId: "f-1",
    nutrientId: "energy_kcal",
    value: "260~510",
    unit: "kcal",
    method: "estimate",
    source: "user",
    sourceId: "",
    datasetVersion: "",
    basis: { kind: "per-100g" },
    evidenceId: "e-1",
    note: "炸鸡热量估算区间",
    ...overrides,
  };
}

test("computeIntakeSnapshot: range observation is excluded from computed, kept structured in perBasis", () => {
  const snapshot = computeIntakeSnapshot({
    amount: { quantity: 100, unit: "g" },
    basis: { kind: "per-100g" },
    effectiveByNutrient: { energy_kcal: { observation: rangeObservation(), selection: null } },
  });
  assert.equal(snapshot.factor, 1);
  assert.ok(!("energy_kcal" in snapshot.computed), "range must not produce a scalar snapshot value");
  const per = snapshot.perBasis.energy_kcal;
  assert.equal(per.value, null);
  assert.deepEqual(per.range, { min: 260, max: 510 });
  assert.equal(per.excludedReason, "range_not_scalar");
  assert.equal(per.method, "estimate");
  assert.equal(per.evidenceId, "e-1");
  assert.equal(per.note, "炸鸡热量估算区间");
  assert.equal(per.unit, "kcal");
});

test("computeIntakeSnapshot: scalar observation still multiplies", () => {
  const snapshot = computeIntakeSnapshot({
    amount: { quantity: 200, unit: "g" },
    basis: { kind: "per-100g" },
    effectiveByNutrient: {
      energy_kcal: { observation: rangeObservation({ id: "o-s-1", value: "260" }), selection: null },
    },
  });
  assert.equal(snapshot.factor, 2);
  assert.equal(snapshot.computed.energy_kcal.value, 520);
  assert.equal(snapshot.perBasis.energy_kcal.value, 260);
});

test("computeIntakeSnapshot: mixed range + scalar in one snapshot", () => {
  const snapshot = computeIntakeSnapshot({
    amount: { quantity: 100, unit: "g" },
    basis: { kind: "per-100g" },
    effectiveByNutrient: {
      energy_kcal: { observation: rangeObservation(), selection: null },
      protein_g: {
        observation: rangeObservation({ id: "o-s-2", nutrientId: "protein_g", value: "12", unit: "g" }),
        selection: null,
      },
    },
  });
  assert.ok(!("energy_kcal" in snapshot.computed));
  assert.equal(snapshot.computed.protein_g.value, 12);
  assert.equal(snapshot.perBasis.energy_kcal.excludedReason, "range_not_scalar");
});
