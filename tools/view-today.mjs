#!/usr/bin/env node
import { LedgerClient } from "../src/infrastructure/ledger-client.mjs";
import { createTodayViewModel } from "../src/presentation/today-view-model.mjs";
import { fail, formatJson, parseArgs } from "./_cli.mjs";

const args = parseArgs();

function usage() {
  console.log(`Usage:
  npm run view:today -- [--date YYYY-MM-DD] [--server http://127.0.0.1:8789]

Prints the UI-facing Today read model. This command does not mutate data.
`);
}

async function main() {
  if (args.help) return usage();
  const client = new LedgerClient(args.server || "http://127.0.0.1:8789");
  const today = await client.today(args.date || "");
  console.log(formatJson(createTodayViewModel(today)));
}

main().catch(fail);
