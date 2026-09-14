#!/usr/bin/env node
import { LedgerClient, filterNewObservations } from "../lib/ledger-client.mjs";
import {
  normalizeBarcode,
  parseOpenFoodFactsPayload,
  toObservationPayloads,
  todayLocalDate,
} from "../lib/nutrition-normalize.mjs";
import { fail, formatJson, mealNote, numberArg, parseArgs } from "./_cli.mjs";

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

async function fetchOpenFoodFacts(barcode) {
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
  url.searchParams.set("lc", "zh");
  url.searchParams.set("cc", "cn");

  const userAgent =
    process.env.NUTRITION_USER_AGENT ||
    "NutritionLedger/0.2 (https://github.com/EOMZON/nutrition-ledger-mvp)";

  const response = await fetch(url, {
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
    intake = await client.createIntake({
      foodId: food.id,
      consumedAt: args["consumed-at"] || new Date().toISOString(),
      localDate: args.date || todayLocalDate(),
      amount: { quantity: grams, unit: "g" },
      basis: normalized.basis,
      note: mealNote(args.meal, `Open Food Facts barcode ${barcode}`),
    });
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
        .filter((id) => ["saturated_fat_g", "sugars_g", "fiber_g"].includes(id)),
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
