import {
  CAPTURE_NUTRIENT_IDS,
  cleanNonNegativeNumber,
  unitForNutrient,
  todayLocalDate,
} from "../domain/nutrients.mjs";
import { formatMealNote } from "../domain/meals.mjs";
import { buildProvenanceNote, normalizeConfidence } from "../domain/provenance.mjs";

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

export function normalizeAiEstimate(input) {
  if (!input || typeof input !== "object") throw new Error("AI estimate JSON object required");

  const rawNutrients = input.nutrients && typeof input.nutrients === "object"
    ? input.nutrients
    : {};
  const nutrients = [];

  for (const nutrientId of CAPTURE_NUTRIENT_IDS) {
    const value = cleanNonNegativeNumber(rawNutrients[nutrientId]);
    if (value === null) continue;
    const unit = unitForNutrient(nutrientId);
    if (!unit) continue;
    nutrients.push({ nutrientId, value, unit });
  }

  if (!nutrients.length) throw new Error("AI estimate contains no supported nutrient values");

  const confidence = normalizeConfidence(input.confidence) ?? "unknown";
  const sourceName = firstNonEmpty(input.source, input.provider, "ai-estimate");
  const sourceId = firstNonEmpty(input.sourceId, input.requestId, input.model, "");
  const label = firstNonEmpty(input.label, input.food, input.name, "AI 餐食估算");

  return {
    kind: "meal_estimate",
    food: {
      label,
      barcode: "",
      brand: "",
      kind: "meal_estimate",
    },
    basis: { kind: "per-serving", servingSize: { quantity: 1, unit: "serving" } },
    amount: { quantity: 1, unit: "serving" },
    source: {
      name: sourceName,
      sourceId,
      datasetVersion: firstNonEmpty(input.datasetVersion, input.model, ""),
      method: "ai_estimate",
      confidence,
    },
    nutrients,
    meal: firstNonEmpty(input.meal, ""),
    note: firstNonEmpty(
      input.note,
      `AI meal estimate; confidence=${String(confidence)}. Portion, cooking oil and hidden ingredients may be inaccurate.`,
    ),
  };
}

export function toObservationPayloads(foodId, normalized) {
  if (!foodId) throw new Error("foodId required");
  if (!normalized?.basis || !Array.isArray(normalized?.nutrients)) {
    throw new Error("normalized nutrition object required");
  }

  const provenanceNote = buildProvenanceNote(
    normalized.note,
    normalized.source?.confidence,
  );

  return normalized.nutrients.map((item) => ({
    foodId,
    nutrientId: item.nutrientId,
    value: item.value,
    unit: item.unit,
    basis: normalized.basis,
    method: normalized.source?.method || "manual",
    source: normalized.source?.name || "user",
    sourceId: normalized.source?.sourceId || "",
    datasetVersion: normalized.source?.datasetVersion || "",
    note: provenanceNote,
  }));
}

export function buildIntakePayload({
  foodId,
  normalized,
  amount,
  consumedAt,
  localDate,
  meal,
  note,
}) {
  if (!foodId) throw new Error("foodId required");
  if (!normalized?.basis) throw new Error("normalized basis required");

  return {
    foodId,
    consumedAt: consumedAt || new Date().toISOString(),
    localDate: localDate || todayLocalDate(),
    amount: amount || normalized.amount || { quantity: 1, unit: "serving" },
    basis: normalized.basis,
    note: formatMealNote(meal || normalized.meal, note || normalized.note),
  };
}
