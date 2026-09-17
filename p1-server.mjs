#!/usr/bin/env node
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { handleHttpRequest as handleLegacyHttpRequest } from "./server.mjs";
import {
  buildDailyExperience,
  confirmBarcodeCandidate,
  createDailyIntake,
  lookupBarcodeCandidate,
  repeatDailyIntake,
} from "./src/application/daily-experience.mjs";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const P1_INDEX = path.join(APP_DIR, "index-p1.html");

function json(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readJsonBody(req, limitBytes = 2_000_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error(`Request too large (>${limitBytes} bytes)`);
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

async function callLegacy({ method = "GET", url = "/", body }) {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  const req = Readable.from(payload ? [payload] : []);
  req.method = method;
  req.url = url;
  req.headers = {
    host: "nutrition-ledger.internal",
    ...(payload
      ? {
          "content-type": "application/json",
          "content-length": String(payload.length),
        }
      : {}),
  };

  let statusCode = 200;
  let responseHeaders = {};
  let ended = false;
  const chunks = [];
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const res = {
    headersSent: false,
    writeHead(status, headers = {}) {
      statusCode = status;
      responseHeaders = headers || {};
      this.headersSent = true;
      return this;
    },
    write(chunk) {
      if (chunk !== undefined && chunk !== null) chunks.push(Buffer.from(chunk));
      this.headersSent = true;
      return true;
    },
    end(chunk) {
      if (ended) return;
      if (chunk !== undefined && chunk !== null) chunks.push(Buffer.from(chunk));
      this.headersSent = true;
      ended = true;
      resolveDone({
        status: statusCode,
        headers: responseHeaders,
        body: Buffer.concat(chunks),
      });
    },
  };

  await handleLegacyHttpRequest(req, res);
  if (!ended) res.end();
  const response = await done;
  const raw = response.body.toString("utf8");
  let parsed = raw;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }

  if (response.status >= 400) {
    const message =
      parsed && typeof parsed === "object" && parsed.error
        ? String(parsed.error)
        : `Legacy API HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return parsed;
}

const gateway = {
  bootstrap: () => callLegacy({ url: "/api/bootstrap" }),
  exportData: () => callLegacy({ url: "/api/export" }),
  getToday: (date) =>
    callLegacy({ url: `/api/today${date ? `?date=${encodeURIComponent(date)}` : ""}` }),
  getFood: (foodId) => callLegacy({ url: `/api/foods/${encodeURIComponent(foodId)}` }),
  createFood: (body) => callLegacy({ method: "POST", url: "/api/foods", body }),
  createObservations: (observations) =>
    callLegacy({ method: "POST", url: "/api/observations/batch", body: { observations } }),
  createIntake: (body) => callLegacy({ method: "POST", url: "/api/intakes", body }),
  patchIntake: (intakeId, patch, reason) =>
    callLegacy({
      method: "POST",
      url: "/api/intakes/patch",
      body: { intakeId, patch, reason },
    }),
};

async function serveP1Index(res) {
  try {
    const html = await fs.readFile(P1_INDEX, "utf8");
    return text(res, 200, html, "text/html; charset=utf-8");
  } catch {
    return text(res, 500, "Missing index-p1.html");
  }
}

export async function handleHttpRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;

  try {
    if (
      req.method === "GET" &&
      (pathname === "/" || pathname === "/index.html") &&
      url.searchParams.get("legacy") !== "1"
    ) {
      return serveP1Index(res);
    }

    if (req.method === "GET" && pathname === "/api/p1/today") {
      const date = url.searchParams.get("date") || "";
      return json(res, 200, await buildDailyExperience(gateway, { date }));
    }

    if (req.method === "POST" && pathname === "/api/p1/intakes") {
      const body = await readJsonBody(req);
      return json(res, 200, { intake: await createDailyIntake(gateway, body) });
    }

    if (req.method === "POST" && pathname === "/api/p1/intakes/repeat") {
      const body = await readJsonBody(req);
      return json(res, 200, { intake: await repeatDailyIntake(gateway, body) });
    }

    if (req.method === "GET" && pathname === "/api/p1/barcode") {
      const barcode = url.searchParams.get("barcode") || "";
      return json(res, 200, { candidate: await lookupBarcodeCandidate(barcode) });
    }

    if (req.method === "POST" && pathname === "/api/p1/barcode/confirm") {
      const body = await readJsonBody(req);
      return json(res, 200, await confirmBarcodeCandidate(gateway, body));
    }

    return handleLegacyHttpRequest(req, res);
  } catch (error) {
    const status = Number(error?.status) >= 400 ? Number(error.status) : 400;
    return json(res, status, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main() {
  const port = Number.parseInt(process.env.PORT || "8789", 10);
  const host = String(process.env.HOST || "127.0.0.1");
  const server = http.createServer((req, res) => {
    void handleHttpRequest(req, res);
  });
  server.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(`nutrition-ledger P1 running: http://${host}:${port}`);
  });
}

const THIS_FILE = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === THIS_FILE) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
