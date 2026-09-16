import test from "node:test";
import assert from "node:assert/strict";
import { createTodayViewModel } from "../src/presentation/today-view-model.mjs";

test("Today read model separates UI grouping from ledger payload", () => {
  const view = createTodayViewModel({
    date: "2026-09-14",
    totals: {
      energy_kcal: { value: 910.4, unit: "kcal" },
      protein_g: { value: 66.26, unit: "g" },
      fat_g: { value: 31.02, unit: "g" },
      carb_g: { value: 88.88, unit: "g" },
    },
    entries: [
      {
        id: "in_breakfast",
        foodId: "food:oats",
        foodLabel: "燕麦",
        localDate: "2026-09-14",
        consumedAt: "2026-09-14T08:00:00+08:00",
        amount: { quantity: 40, unit: "g" },
        note: "meal:breakfast | verified package",
        computed: {
          energy_kcal: { value: 150, unit: "kcal" },
          protein_g: { value: 5.2, unit: "g" },
        },
        perBasis: {
          energy_kcal: { method: "label_verified", source: "package" },
          protein_g: { method: "label_verified", source: "package" },
        },
      },
      {
        id: "in_lunch",
        foodId: "food:meal",
        foodLabel: "鸡胸藜麦沙拉",
        localDate: "2026-09-14",
        consumedAt: "2026-09-14T12:30:00+08:00",
        amount: { quantity: 1, unit: "serving" },
        note: "meal:lunch | photo estimate",
        computed: {
          energy_kcal: { value: 520, unit: "kcal" },
          protein_g: { value: 38, unit: "g" },
        },
        perBasis: {
          energy_kcal: { method: "ai_estimate", source: "vision-model" },
          protein_g: { method: "ai_estimate", source: "vision-model" },
        },
      },
      {
        id: "in_voided",
        foodId: "food:voided",
        foodLabel: "撤销记录",
        localDate: "2026-09-14",
        voidedAt: "2026-09-14T15:00:00+08:00",
      },
    ],
  });

  assert.equal(view.date, "2026-09-14");
  assert.equal(view.entryCount, 2);
  assert.equal(view.approximateEntryCount, 1);
  assert.equal(view.hasApproximateData, true);
  assert.equal(view.groups.length, 2);
  assert.equal(view.groups[0].meal, "breakfast");
  assert.equal(view.groups[1].meal, "lunch");
  assert.equal(view.groups[1].entries[0].provenance.approximate, true);
  assert.deepEqual(
    view.summary.map((item) => item.value),
    [910, 66.3, 31, 88.9],
  );
});
