export const MEAL_ORDER = Object.freeze(["breakfast", "lunch", "dinner", "snack", "other"]);

const MEAL_SET = new Set(MEAL_ORDER);

export function normalizeMeal(value, fallback = "") {
  const meal = String(value || "").trim().toLowerCase();
  if (!meal) return fallback;
  return MEAL_SET.has(meal) ? meal : fallback;
}

export function formatMealNote(meal, note = "") {
  const parts = [];
  const normalizedMeal = normalizeMeal(meal);
  if (normalizedMeal) parts.push(`meal:${normalizedMeal}`);
  const normalizedNote = String(note || "").trim();
  if (normalizedNote) parts.push(normalizedNote);
  return parts.join(" | ");
}

export function extractMealFromNote(note, fallback = "other") {
  const match = String(note || "").match(/(?:^|\|)\s*meal:([a-z-]+)\s*(?:\||$)/i);
  return normalizeMeal(match?.[1], fallback) || fallback;
}

export function mealLabel(meal) {
  const labels = {
    breakfast: "早餐",
    lunch: "午餐",
    dinner: "晚餐",
    snack: "加餐",
    other: "其他",
  };
  return labels[normalizeMeal(meal, "other")] || labels.other;
}
