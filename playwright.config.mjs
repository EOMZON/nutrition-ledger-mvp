import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";

const port = Number.parseInt(process.env.E2E_PORT || "8799", 10);
const host = "127.0.0.1";
const remoteBaseURL = String(process.env.E2E_BASE_URL || "").replace(/\/$/, "");
const dataDir = path.join(
  os.tmpdir(),
  `nutrition-ledger-e2e-${crypto.randomUUID().slice(0, 8)}`,
);

function storageStateFromNetscapeCookieJar(cookieJarPath) {
  if (!cookieJarPath || !fs.existsSync(cookieJarPath)) return undefined;
  const cookies = fs
    .readFileSync(cookieJarPath, "utf8")
    .split(/\r?\n/)
    .map((line) =>
      line.startsWith("#HttpOnly_") ? line.slice("#HttpOnly_".length) : line,
    )
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("\t"))
    .filter((parts) => parts.length >= 7)
    .map(([domain, , cookiePath, secure, expires, name, ...valueParts]) => ({
      name,
      value: valueParts.join("\t"),
      domain,
      path: cookiePath || "/",
      expires: Number(expires) || -1,
      httpOnly: false,
      secure: secure === "TRUE",
      sameSite: "Lax",
    }));
  return cookies.length ? { cookies, origins: [] } : undefined;
}

const storageState = storageStateFromNetscapeCookieJar(process.env.E2E_COOKIE_JAR);

export default {
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: remoteBaseURL || `http://${host}:${port}`,
    headless: true,
    channel: process.env.E2E_BROWSER_CHANNEL || "chrome",
    storageState,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  workers: 1,
  webServer: remoteBaseURL
    ? undefined
    : {
        command: `HOST=${host} PORT=${port} NUTRITION_LEDGER_DATA_DIR=${JSON.stringify(
          dataDir,
        )} node server.mjs`,
        url: `http://${host}:${port}/api/health`,
        reuseExistingServer: false,
        timeout: 30_000,
      },
};
