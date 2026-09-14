#!/usr/bin/env node
import {
  buildIntakePayload,
  toObservationPayloads,
} from "../src/application/capture-normalization.mjs";
import {
  EXTENDED_NUTRIENT_IDS,
  normalizeBarcode,
} from "../src/domain/nutrients.mjs";
import {
  filterNewObservations,
  LedgerClient,
} from "../src/infrastructure/ledger-client.mjs";
import {
  fetchOpenFoodFacts,
  parseOpenFoodFactsPayload,
} from "../src/infrastructure/open-food-facts.mjs";
import { fail, formatJson, numberArg, parseArgs } from "./_cli.mjs";

const args = parseArgs();

function usage() {
  console.log(`Usage:
  npm run capture:barcode -- --barcode <code> [--grams 250] [--meal lunch]

Options:
  --barcode <code>       Required product barcode
  --grams <number>       If supplied, add this amount to Today after importing
  --meal <name>          Optional meal marker: breakfast/lunch/dinner/snack
  --date YYYY-MM-DD      Optional local date for Today
  --consumed-at <ISO>    Optional consumed timestamp
  --server <url>         Ledger server, default http://127.0.0.1:8789
  --dry-run              Fetch and normalize only; do not mutate the ledger
  --force                Re-import observations even if an identical source/value exists
  --help                 Show this help

Environment:
  NUTRITION_USER_AGENT   Open Food Facts User-Agent. Use app/version + contact URL.
`);
}

async function main() {
  if (args.help) return usage();

  const barcode = normalizeBarcode(args.barcode || args._[0]);
  if (!barcode) {
    usage();
    throw new Error("--barcode is required");
  }

  const grams = numberArg(args.grams, "--grams");
  const payload = await fetchOpenFoodFacts(barcode);
  const normalized = parseOpenFoodFactsPayload(payload, barcode);

  if (args["dry-run"]) {
    console.log(formatJson(normalized));
    return;
  }

  const client = new LedgerClient(args.server || "http://127.0.0.1:8789");
  const food = await client.createFood(normalized.food);
  const view = await client.getFood(food.id);
  const observationPayloads = toObservationPayloads(food.id, normalized);
  const pending = args.force
    ? observationPayloads
    : filterNewObservations(view, observationPayloads);

  const created = await client.createObservations(pending);
  let intake = null;

  if (grams !== null) {
    intake = await client.createIntake(
      buildIntakePayload({
        foodId: food.id,
        normalized,
        amount: { quantity: grams, unit: "g" },
        consumedAt: args["consumed-at"] || "",
        localDate: args.date || "",
        meal: args.meal || "",
        note: `Open Food Facts barcode ${barcode}`,
      }),
    );
  }

  console.log(
    formatJson({
      ok: true,
      food,
      source: normalized.source,
      importedObservationCount: created.length,
      skippedDuplicateCount: observationPayloads.length - pending.length,
      extendedNutrientsStored: normalized.nutrients
        .map((item) => item.nutrientId)
        .filter((id) => EXTENDED_NUTRIENT_IDS.includes(id)),
      intake: intake
        ? {
            id: intake.id,
            amount: intake.amount,
            localDate: intake.localDate,
            computed: intake.computed,
          }
        : null,
    }),
  );
}

main().catch(fail);
