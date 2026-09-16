import {
  cleanNonNegativeNumber,
  normalizeBarcode,
} from "../domain/nutrients.mjs";

export const OPEN_FOOD_FACTS_NUTRIENT_SPECS = Object.freeze([
  ["energy_kcal", "energy-kcal_100g", "kcal", 1],
  ["energy_kj", "energy-kj_100g", "kJ", 1],
  ["protein_g", "proteins_100g", "g", 1],
  ["fat_g", "fat_100g", "g", 1],
  ["saturated_fat_g", "saturated-fat_100g", "g", 1],
  ["carb_g", "carbohydrates_100g", "g", 1],
  ["sugars_g", "sugars_100g", "g", 1],
  ["fiber_g", "fiber_100g", "g", 1],
  ["sodium_mg", "sodium_100g", "mg", 1000],
]);

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
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
  for (const [nutrientId, sourceKey, unit, multiplier] of OPEN_FOOD_FACTS_NUTRIENT_SPECS) {
    const value = cleanNonNegativeNumber(nutriments[sourceKey], multiplier);
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

export async function fetchOpenFoodFacts(
  barcodeInput,
  {
    fetchImpl = fetch,
    userAgent = process.env.NUTRITION_USER_AGENT ||
      "NutritionLedger/0.3 (https://github.com/EOMZON/nutrition-ledger-mvp)",
    language = "zh",
    country = "cn",
  } = {},
) {
  const barcode = normalizeBarcode(barcodeInput);
  if (!barcode) throw new Error("barcode required");

  const fields = [
    "code",
    "product_name",
    "product_name_zh",
    "product_name_en",
    "brands",
    "brands_tags",
    "nutriments",
    "last_modified_t",
    "last_modified_datetime",
  ].join(",");

  const url = new URL(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("lc", language);
  url.searchParams.set("cc", country);

  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json",
      "user-agent": userAgent,
    },
    redirect: "follow",
  });

  if (response.status === 404) throw new Error(`barcode ${barcode} not found in Open Food Facts`);
  if (!response.ok) throw new Error(`Open Food Facts HTTP ${response.status}`);

  const payload = await response.json();
  if (!payload?.product) {
    const status = payload?.status ? ` (${payload.status})` : "";
    throw new Error(`Open Food Facts returned no product${status}`);
  }
  return payload;
}
