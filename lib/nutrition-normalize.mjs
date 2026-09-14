const BASE_NUTRIENT_SPECS = [
  ["energy_kcal", "energy-kcal_100g", "kcal", 1],
  ["energy_kj", "energy-kj_100g", "kJ", 1],
  ["protein_g", "proteins_100g", "g", 1],
  ["fat_g", "fat_100g", "g", 1],
  ["carb_g", "carbohydrates_100g", "g", 1],
  ["sodium_mg", "sodium_100g", "mg", 1000],
];

const EXTENDED_NUTRIENT_SPECS = [
  ["saturated_fat_g", "saturated-fat_100g", "g", 1],
  ["sugars_g", "sugars_100g", "g", 1],
  ["fiber_g", "fiber_100g", "g", 1],
];

export const NUTRIENT_SPECS = [...BASE_NUTRIENT_SPECS, ...EXTENDED_NUTRIENT_SPECS];

export function normalizeBarcode(input) {
  return String(input ?? "").replace(/[^0-9]/g, "").trim();
}

export function asFiniteNumber(input) {
  if (input === null || input === undefined || input === "") return null;
  const value = typeof input === "number" ? input : Number.parseFloat(String(input));
  return Number.isFinite(value) ? value : null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function cleanNumber(value, multiplier = 1) {
  const n = asFiniteNumber(value);
  if (n === null) return null;
  const scaled = n * multiplier;
  if (!Number.isFinite(scaled) || scaled < 0) return null;
  return Math.round((scaled + Number.EPSILON) * 10000) / 10000;
}

export function parseOpenFoodFactsPayload(payload, requestedBarcode = "") {
  const product = payload?.product && typeof payload.product === "object" ? payload.product : payload;
  if (!product || typeof product !== "object") {
    throw new Error("Open Food Facts response does not contain a product");
  }

  const barcode = normalizeBarcode(product.code || requestedBarcode);
  if (!barcode) throw new Error("Open Food Facts product is missing a barcode");

  const nutriments = product.nutriments && typeof product.nutriments === "object"
    ? product.nutriments
    : {};

  const nutrients = [];
  for (const [nutrientId, sourceKey, unit, multiplier] of NUTRIENT_SPECS) {
    const value = cleanNumber(nutriments[sourceKey], multiplier);
    if (value === null) continue;
    nutrients.push({ nutrientId, value, unit });
  }

  if (!nutrients.length) {
    throw new Error("Open Food Facts product has no usable per-100g nutrition values");
  }

  const modified = firstNonEmpty(
    product.last_modified_datetime,
    product.last_modified_t,
    product.last_edit_dates_tags?.at?.(-1),
  );

  return {
    kind: "packaged_food",
    food: {
      label: firstNonEmpty(
        product.product_name_zh,
        product.product_name,
        product.product_name_en,
        `包装食品 ${barcode}`,
      ),
      barcode,
      brand: firstNonEmpty(product.brands, product.brands_tags?.[0]),
      kind: "packaged",
    },
    basis: { kind: "per-100g" },
    source: {
      name: "openfoodfacts",
      sourceId: `off:${barcode}`,
      datasetVersion: modified || "api-v3",
      method: "database",
      confidence: "community_database",
    },
    nutrients,
    note:
      "Open Food Facts community database import. Verify against the package label when precision matters.",
  };
}

export function normalizeAiEstimate(input) {
  if (!input || typeof input !== "object") throw new Error("AI estimate JSON object required");

  const rawNutrients = input.nutrients && typeof input.nutrients === "object"
    ? input.nutrients
    : {};

  const units = {
    energy_kcal: "kcal",
    energy_kj: "kJ",
    protein_g: "g",
    fat_g: "g",
    carb_g: "g",
    sodium_mg: "mg",
    saturated_fat_g: "g",
    sugars_g: "g",
    fiber_g: "g",
  };

  const nutrients = [];
  for (const [nutrientId, unit] of Object.entries(units)) {
    const value = cleanNumber(rawNutrients[nutrientId]);
    if (value === null) continue;
    nutrients.push({ nutrientId, value, unit });
  }

  if (!nutrients.length) throw new Error("AI estimate contains no supported nutrient values");

  const confidenceNumber = asFiniteNumber(input.confidence);
  const confidence = confidenceNumber === null
    ? String(input.confidence || "unknown")
    : Math.max(0, Math.min(1, confidenceNumber));

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

  const confidence = normalized.source?.confidence;
  const provenanceNote = [
    String(normalized.note || "").trim(),
    confidence === undefined || confidence === null || confidence === ""
      ? ""
      : `sourceConfidence=${String(confidence)}`,
  ]
    .filter(Boolean)
    .join(" | ");

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

export function todayLocalDate(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(d.getTime())) throw new Error("invalid date");
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
