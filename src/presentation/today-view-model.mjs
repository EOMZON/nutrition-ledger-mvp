import {
  extractMealFromNote,
  mealLabel,
  MEAL_ORDER,
  normalizeMeal,
} from "../domain/meals.mjs";
import { isApproximateMethod, methodLabel } from "../domain/provenance.mjs";

const SUMMARY_NUTRIENTS = Object.freeze([
  ["energy_kcal", "热量", "kcal"],
  ["protein_g", "蛋白质", "g"],
  ["fat_g", "脂肪", "g"],
  ["carb_g", "碳水", "g"],
]);

function round(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const factor = 10 ** digits;
  return Math.round((numeric + Number.EPSILON) * factor) / factor;
}

function formatAmount(amount) {
  const quantity = round(amount?.quantity, 1);
  const unit = String(amount?.unit || "").trim();
  if (quantity === null || !unit) return "";
  const labels = { g: "g", ml: "ml", serving: "份" };
  return `${quantity}${labels[unit] || unit}`;
}

function summarizeEntryProvenance(entry) {
  const methods = new Set();
  const sources = new Set();
  for (const snapshot of Object.values(entry?.perBasis || {})) {
    const method = String(snapshot?.method || "").trim();
    const source = String(snapshot?.source || "").trim();
    if (method) methods.add(method);
    if (source) sources.add(source);
  }

  const methodList = [...methods];
  return {
    methods: methodList,
    methodLabels: methodList.map(methodLabel),
    sources: [...sources],
    approximate: methodList.some(isApproximateMethod),
  };
}

function entryViewModel(entry) {
  const meal = normalizeMeal(entry?.meal) || extractMealFromNote(entry?.note, "other");
  const computed = entry?.computed || {};
  return {
    id: entry?.id || "",
    foodId: entry?.foodId || "",
    title: entry?.foodLabel || entry?.food?.label || "未命名食物",
    meal,
    mealLabel: mealLabel(meal),
    consumedAt: entry?.consumedAt || "",
    localDate: entry?.localDate || "",
    amountLabel: formatAmount(entry?.amount),
    note: String(entry?.note || ""),
    voided: Boolean(entry?.voidedAt),
    energyKcal: round(computed?.energy_kcal?.value, 0),
    macros: {
      proteinG: round(computed?.protein_g?.value, 1),
      fatG: round(computed?.fat_g?.value, 1),
      carbG: round(computed?.carb_g?.value, 1),
    },
    provenance: summarizeEntryProvenance(entry),
  };
}

function summaryViewModel(totals = {}) {
  return SUMMARY_NUTRIENTS.map(([id, label, fallbackUnit]) => ({
    id,
    label,
    value: round(totals?.[id]?.value, id === "energy_kcal" ? 0 : 1) ?? 0,
    unit: String(totals?.[id]?.unit || fallbackUnit),
  }));
}

export function createTodayViewModel(today = {}) {
  const entries = (Array.isArray(today.entries) ? today.entries : [])
    .filter((entry) => !entry?.voidedAt)
    .map(entryViewModel);

  const groups = MEAL_ORDER.map((meal) => ({
    meal,
    label: mealLabel(meal),
    entries: entries.filter((entry) => entry.meal === meal),
  })).filter((group) => group.entries.length > 0);

  return {
    date: String(today.date || ""),
    summary: summaryViewModel(today.totals || {}),
    groups,
    entryCount: entries.length,
    approximateEntryCount: entries.filter((entry) => entry.provenance.approximate).length,
    hasApproximateData: entries.some((entry) => entry.provenance.approximate),
  };
}
