import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const port = Number.parseInt(process.env.E2E_PORT || "8799", 10);
const host = "127.0.0.1";
const dataDir = path.join(
  os.tmpdir(),
  `nutrition-ledger-e2e-${crypto.randomUUID().slice(0, 8)}`,
);

export default {
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  use: {
    baseURL: `http://${host}:${port}`,
    headless: true,
  },
  webServer: {
    command: `HOST=${host} PORT=${port} NUTRITION_LEDGER_DATA_DIR=${JSON.stringify(
      dataDir,
    )} node server.mjs`,
    url: `http://${host}:${port}/api/bootstrap`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
};

