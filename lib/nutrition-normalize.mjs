export {
  asFiniteNumber,
  normalizeBarcode,
  todayLocalDate,
} from "../src/domain/nutrients.mjs";
export {
  buildIntakePayload,
  normalizeAiEstimate,
  toObservationPayloads,
} from "../src/application/capture-normalization.mjs";
export {
  fetchOpenFoodFacts,
  OPEN_FOOD_FACTS_NUTRIENT_SPECS as NUTRIENT_SPECS,
  parseOpenFoodFactsPayload,
} from "../src/infrastructure/open-food-facts.mjs";
