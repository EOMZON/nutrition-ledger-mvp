export const NUTRIENT_DEFINITIONS = Object.freeze([
  { id: "energy_kj", label: "能量", unit: "kJ", capture: true },
  { id: "energy_kcal", label: "能量", unit: "kcal", capture: true },
  { id: "protein_g", label: "蛋白质", unit: "g", capture: true },
  { id: "fat_g", label: "脂肪", unit: "g", capture: true },
  { id: "saturated_fat_g", label: "饱和脂肪", unit: "g", capture: true },
  { id: "carb_g", label: "碳水化合物", unit: "g", capture: true },
  { id: "sugars_g", label: "糖", unit: "g", capture: true },
  { id: "fiber_g", label: "膳食纤维", unit: "g", capture: true },
  { id: "sodium_mg", label: "钠", unit: "mg", capture: true },
  { id: "energy_nrv_pct", label: "能量 NRV%", unit: "%", capture: false },
  { id: "protein_nrv_pct", label: "蛋白质 NRV%", unit: "%", capture: false },
  { id: "fat_nrv_pct", label: "脂肪 NRV%", unit: "%", capture: false },
  { id: "saturated_fat_nrv_pct", label: "饱和脂肪 NRV%", unit: "%", capture: false },
  { id: "carb_nrv_pct", label: "碳水化合物 NRV%", unit: "%", capture: false },
  { id: "sugars_nrv_pct", label: "糖 NRV%", unit: "%", capture: false },
  { id: "sodium_nrv_pct", label: "钠 NRV%", unit: "%", capture: false },
]);

export const NUTRIENT_BY_ID = Object.freeze(
  Object.fromEntries(NUTRIENT_DEFINITIONS.map((item) => [item.id, item])),
);

export const CAPTURE_NUTRIENT_IDS = Object.freeze(
  NUTRIENT_DEFINITIONS.filter((item) => item.capture).map((item) => item.id),
);

export const EXTENDED_NUTRIENT_IDS = Object.freeze([
  "saturated_fat_g",
  "sugars_g",
  "fiber_g",
]);

export function normalizeBarcode(input) {
  return String(input ?? "").replace(/[^0-9]/g, "").trim();
}

export function asFiniteNumber(input) {
  if (input === null || input === undefined || input === "") return null;
  const value = typeof input === "number" ? input : Number.parseFloat(String(input));
  return Number.isFinite(value) ? value : null;
}

export function cleanNonNegativeNumber(value, multiplier = 1) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) return null;
  const scaled = numeric * multiplier;
  if (!Number.isFinite(scaled) || scaled < 0) return null;
  return Math.round((scaled + Number.EPSILON) * 10000) / 10000;
}

export function unitForNutrient(nutrientId) {
  return NUTRIENT_BY_ID[nutrientId]?.unit || "";
}

export function todayLocalDate(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error("invalid date");
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
