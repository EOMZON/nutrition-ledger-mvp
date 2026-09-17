import { deriveFoodShortcuts, mergeIntakeRecords } from "../domain/intake-history.mjs";
import { formatMealNote, normalizeMeal } from "../domain/meals.mjs";
import {
  asFiniteNumber,
  NUTRIENT_DEFINITIONS,
  normalizeBarcode,
} from "../domain/nutrients.mjs";
import { createTodayViewModel } from "../presentation/today-view-model.mjs";
import { fetchOpenFoodFacts, parseOpenFoodFactsPayload } from "../infrastructure/open-food-facts.mjs";

function basisKey(basis) {
  const kind = String(basis?.kind || "");
  if (kind === "per-100g") return "per-100g";
  if (kind === "per-100ml") return "per-100ml";
  if (kind === "per-serving") {
    const quantity = asFiniteNumber(basis?.servingSize?.quantity);
    const unit = String(basis?.servingSize?.unit || "").trim().toLowerCase();
    return quantity && unit ? `per-serving:${quantity}${unit}` : "per-serving";
  }
  return "unknown";
}

function amountUnitForBasis(basis) {
  const kind = String(basis?.kind || "");
  if (kind === "per-100ml") return "ml";
  if (kind === "per-serving") return "serving";
  return "g";
}

function normalizeAmount(amount, basis) {
  const raw = amount && typeof amount === "object" ? amount : { quantity: amount };
  const quantity = asFiniteNumber(raw?.quantity);
  if (quantity === null || quantity <= 0) throw new Error("amount.quantity must be > 0");
  const unit = String(raw?.unit || amountUnitForBasis(basis)).trim().toLowerCase();
  if (!unit) throw new Error("amount.unit required");
  return { quantity, unit };
}

function factorFromAmountAndBasis(amount, basis) {
  if (basis?.kind === "per-100g" && amount.unit === "g") return amount.quantity / 100;
  if (basis?.kind === "per-100ml" && amount.unit === "ml") return amount.quantity / 100;
  if (basis?.kind === "per-serving") {
    if (amount.unit === "serving") return amount.quantity;
    const sizeQuantity = asFiniteNumber(basis?.servingSize?.quantity);
    const sizeUnit = String(basis?.servingSize?.unit || "").trim().toLowerCase();
    if (sizeQuantity && sizeUnit && amount.unit === sizeUnit) return amount.quantity / sizeQuantity;
  }
  return null;
}

function inferBasis(foodView) {
  const hits = Object.values(foodView?.effective || {});
  const candidates = hits
    .map((hit) => hit?.observation?.basis)
    .filter((basis) => basis && basisKey(basis) !== "unknown");
  const preferred = ["per-100g", "per-100ml", "per-serving"];
  for (const kind of preferred) {
    const found = candidates.find((basis) => basis?.kind === kind);
    if (found) return found;
  }
  return { kind: "per-100g" };
}

function cleanUserNote(note) {
  return String(note || "")
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part && !/^meal:[a-z-]+$/i.test(part))
    .join(" | ");
}

export function computeCurrentNutritionSnapshot(foodView, amountInput, basisInput) {
  const basis = basisInput && typeof basisInput === "object" ? basisInput : inferBasis(foodView);
  const amount = normalizeAmount(amountInput, basis);
  const factor = factorFromAmountAndBasis(amount, basis);
  if (factor === null) throw new Error("amount.unit must match basis");

  const targetBasisKey = basisKey(basis);
  const effectiveByNutrient = {};
  for (const hit of Object.values(foodView?.effective || {})) {
    const observation = hit?.observation;
    if (!observation || basisKey(observation.basis) !== targetBasisKey) continue;
    effectiveByNutrient[observation.nutrientId] = observation;
  }

  const computed = {};
  const perBasis = {};
  for (const nutrient of NUTRIENT_DEFINITIONS) {
    const observation = effectiveByNutrient[nutrient.id];
    if (!observation) continue;
    const value = asFiniteNumber(observation.value);
    if (value === null || value < 0) continue;
    const unit = String(observation.unit || nutrient.unit || "").trim();
    if (!unit) continue;
    computed[nutrient.id] = {
      value: Math.round((value * factor + Number.EPSILON) * 10000) / 10000,
      unit,
    };
    perBasis[nutrient.id] = {
      value,
      unit,
      observationId: observation.id,
      source: observation.source,
      sourceId: observation.sourceId,
      datasetVersion: observation.datasetVersion,
      method: observation.method,
      basisKey: targetBasisKey,
      evidenceId: observation.evidenceId || "",
    };
  }

  return { amount, basis, factor, computed, perBasis };
}

export async function createDailyIntake(gateway, payload = {}) {
  const foodId = String(payload.foodId || "").trim();
  if (!foodId) throw new Error("foodId required");

  const meal = normalizeMeal(payload.meal, "other") || "other";
  const foodView = await gateway.getFood(foodId);
  const basis = payload.basis && typeof payload.basis === "object" ? payload.basis : inferBasis(foodView);
  const amount = normalizeAmount(payload.amount, basis);
  const note = formatMealNote(meal, cleanUserNote(payload.note));

  const created = await gateway.createIntake({
    foodId,
    consumedAt: payload.consumedAt,
    localDate: payload.localDate,
    amount,
    basis,
    note,
  });
  const intake = created?.intake;
  if (!intake?.id) throw new Error("legacy intake creation returned no id");

  const snapshot = computeCurrentNutritionSnapshot(foodView, amount, basis);
  const patch = {
    meal,
    amount: snapshot.amount,
    basis: snapshot.basis,
    factor: snapshot.factor,
    perBasis: Object.keys(snapshot.perBasis).length ? snapshot.perBasis : intake.perBasis,
    computed: Object.keys(snapshot.computed).length ? snapshot.computed : intake.computed,
  };

  const patched = await gateway.patchIntake(intake.id, patch, "daily_experience_create");
  return patched?.intake || { ...intake, ...patch };
}

export async function repeatDailyIntake(gateway, payload = {}) {
  const sourceIntakeId = String(payload.sourceIntakeId || "").trim();
  if (!sourceIntakeId) throw new Error("sourceIntakeId required");
  const exported = await gateway.exportData();
  const merged = mergeIntakeRecords(exported?.intakes || []);
  const source = merged[sourceIntakeId];
  if (!source || source.voidedAt) throw new Error("source intake not found or voided");

  return createDailyIntake(gateway, {
    foodId: source.foodId,
    amount: payload.amount || source.amount,
    basis: payload.basis || source.basis,
    meal: payload.meal || source.meal,
    consumedAt: payload.consumedAt,
    localDate: payload.localDate,
    note: cleanUserNote(payload.note || source.note),
  });
}

function nutrientSummary(totals = {}) {
  return NUTRIENT_DEFINITIONS.filter((item) => item.capture).map((item) => ({
    id: item.id,
    label: item.label,
    unit: String(totals?.[item.id]?.unit || item.unit),
    value: Math.round(((asFiniteNumber(totals?.[item.id]?.value) || 0) + Number.EPSILON) * 10) / 10,
  }));
}

export async function buildDailyExperience(gateway, { date } = {}) {
  const [legacyToday, exported, bootstrap] = await Promise.all([
    gateway.getToday(date || ""),
    gateway.exportData(),
    gateway.bootstrap(),
  ]);
  const today = createTodayViewModel(legacyToday || {});
  const foods = bootstrap?.foods || exported?.foods?.items || [];
  const shortcuts = deriveFoodShortcuts(exported?.intakes || [], foods);
  return {
    ...today,
    nutrientSummary: nutrientSummary(legacyToday?.totals || {}),
    recentFoods: shortcuts.recent,
    commonFoods: shortcuts.common,
    foodOptions: foods
      .map((food) => ({
        id: String(food?.id || ""),
        label: String(food?.label || "未命名食物"),
        brand: String(food?.brand || ""),
        barcode: String(food?.barcode || ""),
      }))
      .filter((food) => food.id)
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
  };
}

export async function lookupBarcodeCandidate(barcodeInput, options = {}) {
  const barcode = normalizeBarcode(barcodeInput);
  if (!barcode) throw new Error("barcode required");
  const payload = await fetchOpenFoodFacts(barcode, options);
  return parseOpenFoodFactsPayload(payload, barcode);
}

function sameObservation(existing, candidate) {
  return (
    String(existing?.nutrientId || "") === String(candidate?.nutrientId || "") &&
    basisKey(existing?.basis) === basisKey(candidate?.basis) &&
    String(existing?.method || "") === String(candidate?.method || "") &&
    String(existing?.source || "") === String(candidate?.source || "") &&
    String(existing?.sourceId || "") === String(candidate?.sourceId || "") &&
    String(existing?.datasetVersion || "") === String(candidate?.datasetVersion || "") &&
    String(existing?.unit || "") === String(candidate?.unit || "") &&
    asFiniteNumber(existing?.value) === asFiniteNumber(candidate?.value)
  );
}

export async function confirmBarcodeCandidate(gateway, payload = {}, options = {}) {
  const candidate = await lookupBarcodeCandidate(payload.barcode, options);
  const createdFood = await gateway.createFood(candidate.food);
  const food = createdFood?.food || createdFood;
  if (!food?.id) throw new Error("food creation returned no id");

  const foodView = await gateway.getFood(food.id);
  const observations = candidate.nutrients.map((item) => ({
    foodId: food.id,
    nutrientId: item.nutrientId,
    value: item.value,
    unit: item.unit,
    basis: candidate.basis,
    method: candidate.source.method,
    source: candidate.source.name,
    sourceId: candidate.source.sourceId,
    datasetVersion: candidate.source.datasetVersion,
    note: candidate.note,
  }));
  const missing = observations.filter(
    (observation) => !(foodView?.observations || []).some((existing) => sameObservation(existing, observation)),
  );

  if (missing.length) await gateway.createObservations(missing);

  let intake = null;
  if (payload.addToday !== false) {
    intake = await createDailyIntake(gateway, {
      foodId: food.id,
      amount: payload.amount || { quantity: 100, unit: "g" },
      basis: candidate.basis,
      meal: payload.meal || "other",
      note: payload.note || "",
    });
  }

  return {
    candidate,
    food,
    importedObservations: missing.length,
    skippedDuplicateObservations: observations.length - missing.length,
    intake,
  };
}
