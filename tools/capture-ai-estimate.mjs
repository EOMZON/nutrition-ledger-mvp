#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  buildIntakePayload,
  normalizeAiEstimate,
  toObservationPayloads,
} from "../src/application/capture-normalization.mjs";
import { LedgerClient } from "../src/infrastructure/ledger-client.mjs";
import { fail, formatJson, parseArgs } from "./_cli.mjs";

const args = parseArgs();

function usage() {
  console.log(`Usage:
  npm run capture:ai -- --file estimate.json
  cat estimate.json | npm run capture:ai --

Input JSON example:
{
  "label": "鸡胸肉藜麦沙拉",
  "meal": "lunch",
  "source": "your-multimodal-provider",
  "model": "model-name",
  "requestId": "optional-trace-id",
  "confidence": 0.68,
  "nutrients": {
    "energy_kcal": 520,
    "protein_g": 38,
    "fat_g": 17,
    "carb_g": 53,
    "sodium_mg": 760,
    "fiber_g": 8
  },
  "note": "portion estimated from one meal photo"
}

Options:
  --file <path>          Read JSON from file. Otherwise reads stdin.
  --server <url>         Ledger server, default http://127.0.0.1:8789
  --date YYYY-MM-DD      Optional local date for Today
  --consumed-at <ISO>    Optional consumed timestamp
  --dry-run              Normalize only; do not mutate the ledger
  --no-intake            Save estimate as food defaults but do not add to Today
  --help                 Show this help
`);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function loadInput() {
  if (args.file) return readFile(String(args.file), "utf8");
  if (process.stdin.isTTY) {
    usage();
    throw new Error("provide --file or pipe JSON through stdin");
  }
  return readStdin();
}

async function main() {
  if (args.help) return usage();

  const raw = await loadInput();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error("AI estimate input must be valid JSON");
  }

  const normalized = normalizeAiEstimate(input);
  if (args["dry-run"]) {
    console.log(formatJson(normalized));
    return;
  }

  const client = new LedgerClient(args.server || "http://127.0.0.1:8789");
  const food = await client.createFood(normalized.food);
  const observations = await client.createObservations(toObservationPayloads(food.id, normalized));

  let intake = null;
  if (!args["no-intake"]) {
    intake = await client.createIntake(
      buildIntakePayload({
        foodId: food.id,
        normalized,
        consumedAt: args["consumed-at"] || "",
        localDate: args.date || "",
      }),
    );
  }

  console.log(
    formatJson({
      ok: true,
      warning:
        "AI meal estimates are approximate. They are stored as method=ai_estimate and must not be treated as verified label data.",
      food,
      source: normalized.source,
      importedObservationCount: observations.length,
      intake: intake
        ? {
            id: intake.id,
            localDate: intake.localDate,
            computed: intake.computed,
          }
        : null,
    }),
  );
}

main().catch(fail);
