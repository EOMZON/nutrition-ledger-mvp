#!/usr/bin/env node
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(APP_DIR, "../..");
const CUSTOM_DATA_DIR = Boolean(process.env.NUTRITION_LEDGER_DATA_DIR);

const DEFAULT_DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "nutrition-ledger-mvp")
  : path.join(APP_DIR, "data");
const DATA_DIR = path.resolve(process.env.NUTRITION_LEDGER_DATA_DIR || DEFAULT_DATA_DIR);
const LEDGER_DIR = path.join(DATA_DIR, "ledger");
const STATE_DIR = path.join(DATA_DIR, "state");
const BLOBS_DIR = path.join(DATA_DIR, "blobs");

const FILES = {
  indexHtml: path.join(APP_DIR, "index.html"),
  observations: path.join(LEDGER_DIR, "observations.jsonl"),
  events: path.join(LEDGER_DIR, "events.jsonl"),
  evidence: path.join(LEDGER_DIR, "evidence.jsonl"),
  intakes: path.join(LEDGER_DIR, "intakes.jsonl"),
  foods: path.join(STATE_DIR, "foods.json"),
  selections: path.join(STATE_DIR, "selections.json"),
};

const KV_CONFIG = {
  url: String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, ""),
  token: String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""),
  prefix: String(process.env.NUTRITION_LEDGER_KV_PREFIX || "nutrition-ledger-mvp"),
};

const KV_ENABLED = Boolean(KV_CONFIG.url && KV_CONFIG.token);
const VERCEL_PERSISTENCE_GUARD = Boolean(process.env.VERCEL && !KV_ENABLED && !CUSTOM_DATA_DIR);
const PERSISTENCE_GUARD_STATUS = 503;
const PERSISTENCE_GUARD_MESSAGE =
  "Vercel deployment detected without KV_REST_API_URL/KV_REST_API_TOKEN or NUTRITION_LEDGER_DATA_DIR. " +
  "Configure a KV layer or set NUTRITION_LEDGER_DATA_DIR to a writable persistent path before using this runtime.";

function kvKeyForFilePath(filePath) {
  if (!KV_ENABLED) return null;
  if (filePath === FILES.observations) return `${KV_CONFIG.prefix}:ledger:observations`;
  if (filePath === FILES.events) return `${KV_CONFIG.prefix}:ledger:events`;
  if (filePath === FILES.evidence) return `${KV_CONFIG.prefix}:ledger:evidence`;
  if (filePath === FILES.intakes) return `${KV_CONFIG.prefix}:ledger:intakes`;
  if (filePath === FILES.foods) return `${KV_CONFIG.prefix}:state:foods`;
  if (filePath === FILES.selections) return `${KV_CONFIG.prefix}:state:selections`;
  return null;
}

function kvKeyForBlobName(name) {
  return `${KV_CONFIG.prefix}:blob:${path.basename(String(name || ""))}`;
}

function isKvJsonFile(filePath) {
  return filePath === FILES.foods || filePath === FILES.selections;
}

function isKvJsonlFile(filePath) {
  return (
    filePath === FILES.observations ||
    filePath === FILES.events ||
    filePath === FILES.evidence ||
    filePath === FILES.intakes
  );
}

async function kvExec(command) {
  if (!KV_ENABLED) throw new Error("KV not configured");

  const res = await fetch(KV_CONFIG.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_CONFIG.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const details = (json && (json.error || json.message)) || text || `HTTP ${res.status}`;
    const name = Array.isArray(command) && command.length ? String(command[0]) : "command";
    throw new Error(`KV ${name} failed: ${String(details).trim()}`);
  }

  return json ? json.result : null;
}


const NUTRIENTS = [
  { id: "energy_kj", label: "能量", unit: "kJ" },
  { id: "energy_kcal", label: "能量", unit: "kcal" },
  { id: "protein_g", label: "蛋白质", unit: "g" },
  { id: "fat_g", label: "脂肪", unit: "g" },
  { id: "carb_g", label: "碳水化合物", unit: "g" },
  { id: "sodium_mg", label: "钠", unit: "mg" },
  { id: "energy_nrv_pct", label: "NRV%", unit: "%" },
  { id: "protein_nrv_pct", label: "NRV%", unit: "%" },
  { id: "fat_nrv_pct", label: "NRV%", unit: "%" },
  { id: "carb_nrv_pct", label: "NRV%", unit: "%" },
  { id: "sodium_nrv_pct", label: "NRV%", unit: "%" },
];

let writeQueue = Promise.resolve();

function enqueueWrite(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

function nowIso() {
  return new Date().toISOString();
}

function uuid(prefix) {
  const id = crypto.randomUUID().replace(/-/g, "");
  return prefix ? `${prefix}_${id}` : id;
}

function json(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  res.end(body);
}

function buildPersistenceGuardPayload({ healthCheck } = {}) {
  if (!VERCEL_PERSISTENCE_GUARD) return null;
  return {
    status: PERSISTENCE_GUARD_STATUS,
    body: {
      error: "Missing persistence backend",
      message: PERSISTENCE_GUARD_MESSAGE,
      ...(healthCheck ? { health: "unhealthy" } : {}),
    },
  };
}

async function readBody(req, { limitBytes }) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      throw new Error(`Request too large (>${limitBytes} bytes)`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(req, { limitBytes }) {
  const raw = await readBody(req, { limitBytes });
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

async function fileExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (err) {
    if (err && typeof err === "object" && err.code === "ENOENT") return false;
    throw err;
  }
}

async function ensureDataFiles() {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(BLOBS_DIR, { recursive: true });

  const ledgerFiles = [FILES.observations, FILES.events, FILES.evidence, FILES.intakes];
  for (const f of ledgerFiles) {
    if (await fileExists(f)) continue;
    await fs.writeFile(f, "", "utf8");
  }

  if (KV_ENABLED) {
    const foodsKey = kvKeyForFilePath(FILES.foods);
    const selectionsKey = kvKeyForFilePath(FILES.selections);

    const existingFoods = foodsKey ? await kvExec(["GET", foodsKey]) : null;
    if (foodsKey && (typeof existingFoods !== "string" || !existingFoods.trim())) {
      await kvExec(["SET", foodsKey, JSON.stringify({ version: 1, updatedAt: nowIso(), items: [] })]);
    }

    const existingSelections = selectionsKey ? await kvExec(["GET", selectionsKey]) : null;
    if (selectionsKey && (typeof existingSelections !== "string" || !existingSelections.trim())) {
      await kvExec(["SET", selectionsKey, JSON.stringify({ version: 1, updatedAt: nowIso(), byKey: {} })]);
    }

    return;
  }

  if (!(await fileExists(FILES.foods))) {
    await writeJsonAtomic(FILES.foods, { version: 1, updatedAt: nowIso(), items: [] });
  }
  if (!(await fileExists(FILES.selections))) {
    await writeJsonAtomic(FILES.selections, { version: 1, updatedAt: nowIso(), byKey: {} });
  }
}

let initPromise = null;
async function ensureInit() {
  if (!initPromise) initPromise = ensureDataFiles();
  return initPromise;
}

async function readJson(filePath, fallback) {
  if (KV_ENABLED && isKvJsonFile(filePath)) {
    const key = kvKeyForFilePath(filePath);
    if (key) {
      const raw = await kvExec(["GET", key]);
      if (typeof raw === "string" && raw.trim()) return JSON.parse(raw);
    }
    return fallback;
  }

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err && typeof err === "object" && err.code === "ENOENT") return fallback;
    return fallback;
  }
}

async function writeJsonAtomic(filePath, value) {
  if (KV_ENABLED && isKvJsonFile(filePath)) {
    const key = kvKeyForFilePath(filePath);
    if (!key) throw new Error("KV key mapping missing");
    await kvExec(["SET", key, JSON.stringify(value)]);
    return;
  }

  const tmpPath = `${filePath}.${uuid("tmp")}`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fs.rename(tmpPath, filePath);
}

async function readJsonl(filePath) {
  if (KV_ENABLED && isKvJsonlFile(filePath)) {
    const key = kvKeyForFilePath(filePath);
    if (key) {
      const result = await kvExec(["LRANGE", key, 0, -1]);
      const lines = Array.isArray(result) ? result : [];
      const out = [];
      for (const line of lines) {
        if (typeof line !== "string") continue;
        try {
          out.push(JSON.parse(line));
        } catch {
          continue;
        }
      }
      return out;
    }
    return [];
  }

  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err && typeof err === "object" && err.code === "ENOENT") return [];
    throw err;
  }
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return out;
}

async function appendJsonl(filePath, record) {
  if (KV_ENABLED && isKvJsonlFile(filePath)) {
    const key = kvKeyForFilePath(filePath);
    if (!key) throw new Error("KV key mapping missing");
    await kvExec(["RPUSH", key, JSON.stringify(record)]);
    return;
  }

  await fs.appendFile(filePath, JSON.stringify(record) + "\n", "utf8");
}

async function writeBlob(name, buffer) {
  if (KV_ENABLED) {
    await kvExec(["SET", kvKeyForBlobName(name), buffer.toString("base64")]);
    await fs.writeFile(path.join(BLOBS_DIR, path.basename(name)), buffer);
    return;
  }
  await fs.writeFile(path.join(BLOBS_DIR, path.basename(name)), buffer);
}

async function readBlob(name) {
  if (KV_ENABLED) {
    const raw = await kvExec(["GET", kvKeyForBlobName(name)]);
    if (typeof raw !== "string" || !raw) return null;
    return Buffer.from(raw, "base64");
  }
  try {
    return await fs.readFile(path.join(BLOBS_DIR, path.basename(name)));
  } catch (err) {
    if (err && typeof err === "object" && err.code === "ENOENT") return null;
    throw err;
  }
}


function normalizeBarcode(input) {
  const raw = String(input || "").trim();
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits;
}

function makeFoodId({ barcode }) {
  const bc = normalizeBarcode(barcode);
  if (bc) return `food:barcode:${bc}`;
  return `food:custom:${uuid("food")}`;
}

function basisKeyFromBasis(basis) {
  const kind = basis?.kind || "";
  if (kind === "per-100g") return "per-100g";
  if (kind === "per-100ml") return "per-100ml";
  if (kind === "per-serving") {
    const size = basis?.servingSize;
    const qty = size?.quantity;
    const unit = size?.unit;
    if (typeof qty === "number" && unit) return `per-serving:${qty}${unit}`;
    return "per-serving";
  }
  return "unknown";
}

function makeSelectionKey({ foodId, nutrientId, basis }) {
  return `${foodId}|${nutrientId}|${basisKeyFromBasis(basis)}`;
}

function pickDefaultObservation(observations) {
  const rank = (o) => {
    const method = String(o.method || "");
    if (method === "label_verified") return 5;
    if (method === "label_ocr") return 4;
    if (method === "manual") return 3;
    if (method === "database") return 2;
    if (method === "derived") return 1;
    return 0;
  };
  return observations
    .slice()
    .sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return rb - ra;
      const ta = Date.parse(a.createdAt || "") || 0;
      const tb = Date.parse(b.createdAt || "") || 0;
      return tb - ta;
    })[0];
}

function mergeEvidenceLedger(records) {
  const byId = {};
  for (const rec of records) {
    if (!rec || typeof rec !== "object") continue;
    const id = String(rec.id || "").trim();
    if (!id) continue;
    if (rec.type === "evidence.create") {
      byId[id] = rec;
      continue;
    }
    if (rec.type === "evidence.patch" && rec.patch && typeof rec.patch === "object") {
      const base = byId[id] && typeof byId[id] === "object" ? byId[id] : { id, type: "evidence.create" };
      byId[id] = deepMerge(base, rec.patch, { updatedAt: rec.createdAt || nowIso() });
    }
  }
  return byId;
}

function mergeIntakeLedger(records) {
  const byId = {};
  for (const rec of records) {
    if (!rec || typeof rec !== "object") continue;
    const id = String(rec.id || "").trim();
    if (!id) continue;

    if (rec.type === "intake.add") {
      byId[id] = rec;
      continue;
    }
    if (rec.type === "intake.patch" && rec.patch && typeof rec.patch === "object") {
      const base = byId[id] && typeof byId[id] === "object" ? byId[id] : { id, type: "intake.add" };
      byId[id] = deepMerge(base, rec.patch, { updatedAt: rec.createdAt || nowIso() });
      continue;
    }
    if (rec.type === "intake.void") {
      const base = byId[id] && typeof byId[id] === "object" ? byId[id] : { id, type: "intake.add" };
      byId[id] = deepMerge(base, {
        voidedAt: rec.createdAt || nowIso(),
        voidedReason: String(rec.reason || "").trim(),
        updatedAt: rec.createdAt || nowIso(),
      });
    }
  }
  return byId;
}

function deepMerge(base, ...patches) {
  const out = Array.isArray(base) ? base.slice() : { ...(base || {}) };
  for (const patch of patches) {
    if (!patch || typeof patch !== "object") continue;
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        out[k] = deepMerge(out[k], v);
        continue;
      }
      out[k] = v;
    }
  }
  return out;
}

async function loadSnapshot() {
  const foods = await readJson(FILES.foods, { version: 1, items: [] });
  const selections = await readJson(FILES.selections, { version: 1, byKey: {} });
  return { foods, selections };
}

async function getBootstrap() {
  const { foods } = await loadSnapshot();
  const r2 = await detectR2Config();
  return {
    nutrients: NUTRIENTS,
    foods: foods.items || [],
    r2,
  };
}

async function getEvidenceList({ limit }) {
  const rawLimit = Number.parseInt(String(limit || "0"), 10);
  const safeLimit = rawLimit > 0 ? Math.min(500, rawLimit) : 200;

  const evidenceLedger = await readJsonl(FILES.evidence);
  const evidenceById = mergeEvidenceLedger(evidenceLedger);

  const items = Object.values(evidenceById)
    .filter((e) => e && typeof e === "object")
    .filter((e) => e.type === "evidence.create")
    .sort((a, b) => {
      const ta = Date.parse(a.updatedAt || a.createdAt || "") || 0;
      const tb = Date.parse(b.updatedAt || b.createdAt || "") || 0;
      return tb - ta;
    })
    .slice(0, safeLimit);

  return { items, limit: safeLimit, totalApprox: Object.keys(evidenceById).length };
}

async function getFoodView(foodId) {
  const { foods, selections } = await loadSnapshot();
  const food = (foods.items || []).find((f) => f.id === foodId) || null;
  if (!food) return null;

  const allObservations = (await readJsonl(FILES.observations)).filter((o) => o.foodId === foodId);
  const allEvents = (await readJsonl(FILES.events)).filter((e) => e.foodId === foodId);
  const evidenceLedger = await readJsonl(FILES.evidence);
  const evidenceById = mergeEvidenceLedger(evidenceLedger);

  const grouped = {};
  for (const o of allObservations) {
    const key = makeSelectionKey({ foodId: o.foodId, nutrientId: o.nutrientId, basis: o.basis });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  }

  const effective = {};
  for (const [key, observations] of Object.entries(grouped)) {
    const sel = selections.byKey?.[key];
    const selectedId = sel?.selectedObservationId;
    let picked = selectedId ? observations.find((o) => o.id === selectedId) : null;
    if (!picked) picked = pickDefaultObservation(observations) || null;
    if (picked) {
      effective[key] = {
        observation: picked,
        selection: sel || null,
      };
    }
  }

  return {
    food,
    observations: allObservations,
    events: allEvents,
    selections: selections.byKey || {},
    evidence: evidenceById,
    effective,
  };
}

function parseNumeric(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.+-eE]/g, "");
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return n;
}

function clampNumber(n, { min = -1e12, max = 1e12 } = {}) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function normalizeAmount(amount) {
  const qty = clampNumber(Number(amount?.quantity), { min: 0, max: 1e9 });
  const unit = String(amount?.unit || "").trim().toLowerCase();
  if (qty == null) return null;
  if (!unit) return null;
  return { quantity: qty, unit };
}

function factorFromAmountAndBasis(amount, basis) {
  const a = normalizeAmount(amount);
  if (!a) return null;
  const kind = String(basis?.kind || "");

  if (kind === "per-100g" && a.unit === "g") return a.quantity / 100;
  if (kind === "per-100ml" && a.unit === "ml") return a.quantity / 100;

  if (kind === "per-serving") {
    if (a.unit === "serving") return a.quantity;
    const size = basis?.servingSize;
    const sizeQty = typeof size?.quantity === "number" ? size.quantity : parseNumeric(size?.quantity);
    const sizeUnit = String(size?.unit || "").trim().toLowerCase();
    if (sizeQty && sizeUnit && a.unit === sizeUnit) return a.quantity / sizeQty;
  }

  return null;
}

async function getEffectiveObservationsForFood(foodId, basis) {
  const { selections } = await loadSnapshot();
  const basisKey = basisKeyFromBasis(basis);
  const allObservations = (await readJsonl(FILES.observations)).filter(
    (o) => o.foodId === foodId && basisKeyFromBasis(o.basis) === basisKey,
  );

  const grouped = {};
  for (const o of allObservations) {
    if (!grouped[o.nutrientId]) grouped[o.nutrientId] = [];
    grouped[o.nutrientId].push(o);
  }

  const effectiveByNutrient = {};
  for (const [nutrientId, observations] of Object.entries(grouped)) {
    const key = makeSelectionKey({ foodId, nutrientId, basis });
    const sel = selections.byKey?.[key];
    const selectedId = sel?.selectedObservationId;
    let picked = selectedId ? observations.find((o) => o.id === selectedId) : null;
    if (!picked) picked = pickDefaultObservation(observations) || null;
    if (picked) effectiveByNutrient[nutrientId] = { observation: picked, selection: sel || null };
  }
  return effectiveByNutrient;
}

function localDateFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeIntakeSnapshot({ amount, basis, effectiveByNutrient }) {
  const factor = factorFromAmountAndBasis(amount, basis);
  if (factor == null) {
    return { factor: null, computed: {}, perBasis: {} };
  }

  const computed = {};
  const perBasis = {};

  for (const nutrient of NUTRIENTS) {
    const hit = effectiveByNutrient?.[nutrient.id];
    const obs = hit?.observation;
    if (!obs) continue;
    const per = parseNumeric(obs.value);
    if (per == null) continue;
    const unit = String(obs.unit || nutrient.unit || "").trim();
    if (!unit) continue;
    const val = clampNumber(per * factor, { min: 0, max: 1e12 });
    if (val == null) continue;
    computed[nutrient.id] = { value: val, unit };
    perBasis[nutrient.id] = {
      value: per,
      unit,
      observationId: obs.id,
      source: obs.source,
      sourceId: obs.sourceId,
      datasetVersion: obs.datasetVersion,
      method: obs.method,
      basisKey: basisKeyFromBasis(obs.basis),
      evidenceId: obs.evidenceId || "",
    };
  }
  return { factor, computed, perBasis };
}

async function createIntake({ foodId, consumedAt, localDate, amount, basis, note }) {
  return enqueueWrite(() =>
    createIntakeNoQueue({ foodId, consumedAt, localDate, amount, basis, note }),
  );
}

async function patchIntake({ intakeId, patch, reason }) {
  return enqueueWrite(() =>
    patchIntakeNoQueue({ intakeId, patch, reason }),
  );
}

async function voidIntake({ intakeId, reason }) {
  return enqueueWrite(() =>
    voidIntakeNoQueue({ intakeId, reason }),
  );
}

async function recalcIntake({ intakeId, basis }) {
  return enqueueWrite(() =>
    recalcIntakeNoQueue({ intakeId, basis }),
  );
}

async function createFood({ label, barcode, brand, kind }) {
  return enqueueWrite(() => createFoodNoQueue({ label, barcode, brand, kind }));
}

async function setSelection({ foodId, nutrientId, basis, toObservationId, mode, reason, by, fromObservationId }) {
  return enqueueWrite(() =>
    setSelectionNoQueue({ foodId, nutrientId, basis, toObservationId, mode, reason, by, fromObservationId }),
  );
}

async function createObservation({ foodId, nutrientId, value, unit, basis, method, source, sourceId, datasetVersion, evidenceId, parentId, note }) {
  return enqueueWrite(() =>
    createObservationNoQueue({
      foodId,
      nutrientId,
      value,
      unit,
      basis,
      method,
      source,
      sourceId,
      datasetVersion,
      evidenceId,
      parentId,
      note,
    }),
  );
}

async function createObservationsBatch({ observations }) {
  return enqueueWrite(() => createObservationsBatchNoQueue({ observations }));
}

function decodeBase64Data(dataBase64) {
  const raw = String(dataBase64 || "");
  const m = raw.match(/^data:[^;]+;base64,(.*)$/);
  const b64 = m ? m[1] : raw;
  return Buffer.from(b64, "base64");
}

function extFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("webp")) return ".webp";
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  return "";
}

function contentTypeForExt(ext) {
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function pickFirst(...values) {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return "";
}

async function resolveR2Secrets() {
  const localEnvPath = path.join(APP_DIR, ".env");
  const localEnv = await readEnvFile(localEnvPath);

  const oldlifeEnvPath = path.join(REPO_ROOT, "8_Workflow/video/OLDLIFEASSONG/.env");
  const oldlifeEnv = await readEnvFile(oldlifeEnvPath);

  const accountId = pickFirst(
    process.env.CLOUDFLARE_ACCOUNT_ID,
    localEnv.CLOUDFLARE_ACCOUNT_ID,
    oldlifeEnv.CLOUDFLARE_ACCOUNT_ID,
  );
  const apiToken = pickFirst(
    process.env.CLOUDFLARE_API_TOKEN,
    localEnv.CLOUDFLARE_API_TOKEN,
    oldlifeEnv.CLOUDFLARE_API_TOKEN,
  );

  const bucket = pickFirst(
    process.env.R2_BUCKET,
    process.env.R2_BUCKET_NAME,
    process.env.BUCKET,
    process.env.bucket,
    localEnv.R2_BUCKET,
    localEnv.R2_BUCKET_NAME,
    localEnv.BUCKET,
    localEnv.bucket,
    oldlifeEnv.R2_BUCKET,
    oldlifeEnv.R2_BUCKET_NAME,
    oldlifeEnv.BUCKET,
    oldlifeEnv.bucket,
  );

  const publicBase = pickFirst(
    process.env.R2_PUBLIC_BASE_URL,
    process.env.PUBLIC_URL,
    process.env.public_url,
    localEnv.R2_PUBLIC_BASE_URL,
    localEnv.PUBLIC_URL,
    localEnv.public_url,
    oldlifeEnv.R2_PUBLIC_BASE_URL,
    oldlifeEnv.PUBLIC_URL,
    oldlifeEnv.public_url,
  );

  return {
    available: Boolean(accountId && apiToken && bucket),
    accountId,
    apiToken,
    bucket,
    publicBase,
  };
}

async function detectR2Config() {
  const cfg = await resolveR2Secrets();
  return {
    available: Boolean(cfg.accountId && cfg.apiToken && cfg.bucket),
    accountId: cfg.accountId ? "configured" : "",
    bucket: cfg.bucket || "",
    publicBase: cfg.publicBase || "",
  };
}

async function readEnvFile(filePath) {
  const out = {};
  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const idx = l.indexOf("=");
    if (idx === -1) continue;
    const key = l.slice(0, idx).trim();
    const value = l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!key) continue;
    if (!(key in out)) out[key] = value;
  }
  return out;
}

async function runUploadToR2(filePath, { keyPrefix }) {
  const cfg = await resolveR2Secrets();
  if (!cfg.available) {
    throw new Error("Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / R2_BUCKET in env");
  }

  const prefix = String(keyPrefix || "nutrition-ledger/evidence")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const objectPath = path.basename(filePath);
  const key = prefix ? `${prefix}/${objectPath}` : objectPath;

  const data = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypeForExt(ext);

  const url = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/r2/buckets/${encodeURIComponent(
    cfg.bucket,
  )}/objects/${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${cfg.apiToken}`,
      "Content-Type": contentType,
    },
    body: data,
  });

  if (!response.ok) {
    let text = "";
    try {
      text = await response.text();
    } catch {
      text = "";
    }
    throw new Error(`R2 upload failed: HTTP ${response.status} ${response.statusText} ${text}`.trim());
  }

  const publicUrl = cfg.publicBase ? `${cfg.publicBase.replace(/\/+$/, "")}/${key}` : "";

  return {
    url: publicUrl,
    r2Bucket: cfg.bucket,
    r2Key: key,
  };
}

async function createEvidence({ kind, preview, thumb, ocrText, note, uploadToR2 }) {
  return enqueueWrite(() => createEvidenceNoQueue({ kind, preview, thumb, ocrText, note, uploadToR2 }));
}

async function createIntakeNoQueue({ foodId, consumedAt, localDate, amount, basis, note }) {
  const { foods } = await loadSnapshot();
  const food = (foods.items || []).find((f) => f.id === foodId) || null;
  if (!foodId || !food) throw new Error("foodId invalid");

  const a = normalizeAmount(amount);
  if (!a) throw new Error("amount.quantity/unit required");

  const now = nowIso();
  const consumed = String(consumedAt || now).trim() || now;
  const date = String(localDate || "").trim() || localDateFromIso(consumed) || localDateFromIso(now);
  if (!date) throw new Error("localDate required");

  const b = basis && typeof basis === "object" ? basis : { kind: "per-100g" };
  const effective = await getEffectiveObservationsForFood(foodId, b);
  const snapshot = computeIntakeSnapshot({ amount: a, basis: b, effectiveByNutrient: effective });
  if (snapshot.factor == null) {
    throw new Error("amount.unit must match basis (g/ml/serving)");
  }

  const intakeId = uuid("in");
  const createdBy = "user:local";
  const record = {
    type: "intake.add",
    id: intakeId,
    foodId,
    foodLabel: String(food.label || ""),
    consumedAt: consumed,
    localDate: date,
    amount: a,
    basis: b,
    resolvedAt: nowIso(),
    factor: snapshot.factor,
    perBasis: snapshot.perBasis,
    computed: snapshot.computed,
    note: String(note || "").trim(),
    createdAt: now,
    createdBy,
    updatedAt: now,
    updatedBy: createdBy,
  };

  await appendJsonl(FILES.intakes, record);
  return record;
}

async function patchIntakeNoQueue({ intakeId, patch, reason }) {
  const id = String(intakeId || "").trim();
  if (!id) throw new Error("intakeId required");
  if (!patch || typeof patch !== "object") throw new Error("patch required");

  const records = await readJsonl(FILES.intakes);
  const byId = mergeIntakeLedger(records);
  const current = byId[id];
  if (!current) throw new Error("intake not found");

  const next = deepMerge(current, patch, {
    updatedAt: nowIso(),
    updatedBy: "user:local",
  });

  let needsRecompute = false;
  if (patch.amount) needsRecompute = true;
  if (patch.basis) needsRecompute = true;

  if (needsRecompute) {
    const a = normalizeAmount(next.amount);
    const b = next.basis && typeof next.basis === "object" ? next.basis : { kind: "per-100g" };
    const factor = factorFromAmountAndBasis(a, b);
    if (factor == null) throw new Error("amount.unit must match basis (g/ml/serving)");
    next.factor = factor;
    const computed = {};
    for (const [nutrientId, per] of Object.entries(next.perBasis || {})) {
      const base = parseNumeric(per.value);
      if (base == null) continue;
      const unit = String(per.unit || "").trim();
      if (!unit) continue;
      const val = clampNumber(base * factor, { min: 0, max: 1e12 });
      if (val == null) continue;
      computed[nutrientId] = { value: val, unit };
    }
    next.computed = computed;
  }

  const evt = {
    type: "intake.patch",
    id,
    patch: deepMerge(patch, needsRecompute ? { factor: next.factor, computed: next.computed, amount: next.amount, basis: next.basis } : {}),
    reason: String(reason || "manual_edit"),
    createdAt: nowIso(),
    createdBy: "user:local",
  };
  await appendJsonl(FILES.intakes, evt);
  return { intake: next, event: evt };
}

async function voidIntakeNoQueue({ intakeId, reason }) {
  const id = String(intakeId || "").trim();
  if (!id) throw new Error("intakeId required");

  const evt = {
    type: "intake.void",
    id,
    reason: String(reason || "user_void").trim(),
    createdAt: nowIso(),
    createdBy: "user:local",
  };
  await appendJsonl(FILES.intakes, evt);
  return { event: evt };
}

async function recalcIntakeNoQueue({ intakeId, basis }) {
  const id = String(intakeId || "").trim();
  if (!id) throw new Error("intakeId required");

  const records = await readJsonl(FILES.intakes);
  const byId = mergeIntakeLedger(records);
  const current = byId[id];
  if (!current) throw new Error("intake not found");

  const b = basis && typeof basis === "object" ? basis : current.basis || { kind: "per-100g" };
  const a = normalizeAmount(current.amount);
  if (!a) throw new Error("intake amount invalid");

  const effective = await getEffectiveObservationsForFood(current.foodId, b);
  const snapshot = computeIntakeSnapshot({ amount: a, basis: b, effectiveByNutrient: effective });
  if (snapshot.factor == null) throw new Error("amount.unit must match basis (g/ml/serving)");

  const patch = {
    basis: b,
    resolvedAt: nowIso(),
    factor: snapshot.factor,
    perBasis: snapshot.perBasis,
    computed: snapshot.computed,
    updatedAt: nowIso(),
    updatedBy: "user:local",
  };

  const evt = {
    type: "intake.patch",
    id,
    patch,
    reason: "recalc_latest_defaults",
    createdAt: nowIso(),
    createdBy: "user:local",
  };
  await appendJsonl(FILES.intakes, evt);
  return { event: evt };
}

async function createFoodNoQueue({ label, barcode, brand, kind }) {
  const foods = await readJson(FILES.foods, { version: 1, items: [] });
  const items = Array.isArray(foods.items) ? foods.items : [];

  const normalizedBarcode = normalizeBarcode(barcode);
  if (normalizedBarcode) {
    const existing = items.find((f) => f.barcode === normalizedBarcode);
    if (existing) return existing;
  }

  const now = nowIso();
  const food = {
    id: makeFoodId({ barcode: normalizedBarcode }),
    label: String(label || "").trim() || "(未命名)",
    kind: String(kind || "packaged"),
    barcode: normalizedBarcode || "",
    brand: String(brand || "").trim(),
    createdAt: now,
    updatedAt: now,
  };

  items.push(food);
  await writeJsonAtomic(FILES.foods, { version: 1, updatedAt: nowIso(), items });
  return food;
}

async function setSelectionNoQueue({ foodId, nutrientId, basis, toObservationId, mode, reason, by, fromObservationId }) {
  const selections = await readJson(FILES.selections, { version: 1, byKey: {} });
  const key = makeSelectionKey({ foodId, nutrientId, basis });
  const prev = selections.byKey?.[key] || null;
  const from = fromObservationId || prev?.selectedObservationId || "";

  const patch = {
    selectedObservationId: toObservationId,
    mode: mode || "pinned",
    updatedAt: nowIso(),
    updatedBy: by || "user:local",
  };

  const byKey = selections.byKey && typeof selections.byKey === "object" ? selections.byKey : {};
  byKey[key] = patch;
  await writeJsonAtomic(FILES.selections, { version: 1, updatedAt: nowIso(), byKey });

  const evt = {
    type: "selection.set",
    id: uuid("evt"),
    key,
    foodId,
    nutrientId,
    basisKey: basisKeyFromBasis(basis),
    from: from || "",
    to: toObservationId,
    mode: patch.mode,
    reason: String(reason || "manual"),
    createdAt: nowIso(),
    createdBy: patch.updatedBy,
  };
  await appendJsonl(FILES.events, evt);

  return { key, selection: patch, event: evt };
}

async function createObservationNoQueue({
  foodId,
  nutrientId,
  value,
  unit,
  basis,
  method,
  source,
  sourceId,
  datasetVersion,
  evidenceId,
  parentId,
  note,
}) {
  const obs = {
    type: "observation",
    id: uuid("obs"),
    foodId,
    nutrientId,
    value: String(value ?? "").trim(),
    unit: String(unit || "").trim(),
    basis: basis || { kind: "per-100g" },
    method: String(method || "manual"),
    source: String(source || "user"),
    sourceId: String(sourceId || "").trim(),
    datasetVersion: String(datasetVersion || "").trim(),
    evidenceId: evidenceId ? String(evidenceId) : "",
    parentId: parentId ? String(parentId) : "",
    note: String(note || "").trim(),
    createdAt: nowIso(),
    createdBy: "user:local",
  };

  if (!obs.foodId || !obs.nutrientId || obs.value === "" || !obs.unit) {
    throw new Error("Missing required fields: foodId, nutrientId, value, unit");
  }

  await appendJsonl(FILES.observations, obs);
  await setSelectionNoQueue({
    foodId: obs.foodId,
    nutrientId: obs.nutrientId,
    basis: obs.basis,
    toObservationId: obs.id,
    mode: "pinned",
    reason: obs.parentId ? "manual_edit" : "create_observation",
    by: obs.createdBy,
    fromObservationId: obs.parentId || "",
  });

  return obs;
}

async function createObservationsBatchNoQueue({ observations }) {
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new Error("observations[] required");
  }
  const created = [];
  for (const item of observations) {
    const obs = await createObservationNoQueue(item);
    created.push(obs);
  }
  return created;
}

async function createEvidenceNoQueue({ kind, preview, thumb, ocrText, note, uploadToR2 }) {
  if (!preview?.dataBase64 || !preview?.mime) throw new Error("preview required");
  if (!thumb?.dataBase64 || !thumb?.mime) throw new Error("thumb required");

  const evidenceId = uuid("ev");
  const previewExt = extFromMime(preview.mime) || ".webp";
  const thumbExt = extFromMime(thumb.mime) || ".webp";
  const previewName = `${evidenceId}${previewExt}`;
  const thumbName = `${evidenceId}.thumb${thumbExt}`;

  const previewBuf = decodeBase64Data(preview.dataBase64);
  const thumbBuf = decodeBase64Data(thumb.dataBase64);

  const previewSha256 = crypto.createHash("sha256").update(previewBuf).digest("hex");

  const previewPath = path.join(BLOBS_DIR, previewName);
  const thumbPath = path.join(BLOBS_DIR, thumbName);
  await Promise.all([writeBlob(previewName, previewBuf), writeBlob(thumbName, thumbBuf)]);

  const createdAt = nowIso();
  const createdBy = "user:local";
  const record = {
    type: "evidence.create",
    id: evidenceId,
    kind: String(kind || "label_photo"),
    preview: {
      path: `/blobs/${previewName}`,
      mime: String(preview.mime),
      bytes: previewBuf.length,
      width: preview.width || null,
      height: preview.height || null,
      sha256: previewSha256,
    },
    thumb: {
      path: `/blobs/${thumbName}`,
      mime: String(thumb.mime),
      bytes: thumbBuf.length,
      width: thumb.width || null,
      height: thumb.height || null,
      sha256: crypto.createHash("sha256").update(thumbBuf).digest("hex"),
    },
    r2: { url: "", thumbUrl: "", r2Bucket: "", r2Key: "", thumbR2Key: "" },
    ocrText: String(ocrText || ""),
    note: String(note || ""),
    createdAt,
    createdBy,
    updatedAt: createdAt,
  };

  let uploadError = "";
  if (uploadToR2) {
    try {
      const uploadedPreview = await runUploadToR2(previewPath, { keyPrefix: "nutrition-ledger/evidence" });
      const uploadedThumb = await runUploadToR2(thumbPath, { keyPrefix: "nutrition-ledger/evidence" });
      record.r2 = {
        url: uploadedPreview.url || "",
        thumbUrl: uploadedThumb.url || uploadedPreview.url || "",
        r2Bucket: uploadedPreview.r2Bucket || uploadedThumb.r2Bucket || "",
        r2Key: uploadedPreview.r2Key || "",
        thumbR2Key: uploadedThumb.r2Key || "",
      };
      record.updatedAt = nowIso();
    } catch (err) {
      uploadError = err instanceof Error ? err.message : String(err);
    }
  }

  await appendJsonl(FILES.evidence, record);
  if (uploadError) {
    await appendJsonl(FILES.evidence, {
      type: "evidence.patch",
      id: evidenceId,
      patch: { uploadError, updatedAt: nowIso() },
      createdAt: nowIso(),
      createdBy,
    });
  }

  return { evidence: record, uploadError };
}

async function serveBlob(req, res, pathname) {
  const name = path.basename(pathname.replace(/^\/blobs\//, ""));
  if (!name) return text(res, 404, "Not found");
  const body = await readBlob(name);
  if (!body) return text(res, 404, "Not found");
  const ct = contentTypeForExt(path.extname(name).toLowerCase());
  res.writeHead(200, {
    "Content-Type": ct,
    "Content-Length": body.length,
    "Cache-Control": "private, no-store",
  });
  res.end(body);
}

async function serveIndex(res) {
  try {
    const html = await fs.readFile(FILES.indexHtml, "utf8");
    text(res, 200, html, "text/html; charset=utf-8");
  } catch {
    text(res, 500, "Missing index.html");
  }
}

async function getTodayView({ date }) {
  const target = String(date || "").trim() || localDateFromIso(nowIso());
  const { foods } = await loadSnapshot();
  const foodsById = {};
  for (const f of foods.items || []) foodsById[f.id] = f;

  const records = await readJsonl(FILES.intakes);
  const merged = mergeIntakeLedger(records);
  const entries = Object.values(merged)
    .filter((i) => i && typeof i === "object")
    .filter((i) => String(i.localDate || "") === target)
    .map((i) => ({
      ...i,
      food: foodsById[i.foodId] || null,
    }))
    .sort((a, b) => (Date.parse(b.consumedAt || "") || 0) - (Date.parse(a.consumedAt || "") || 0));

  const evidenceIds = new Set();
  for (const entry of entries) {
    for (const per of Object.values(entry.perBasis || {})) {
      const evId = String(per?.evidenceId || "").trim();
      if (evId) evidenceIds.add(evId);
    }
  }
  let evidence = {};
  if (evidenceIds.size) {
    const evidenceLedger = await readJsonl(FILES.evidence);
    const evidenceById = mergeEvidenceLedger(evidenceLedger);
    for (const id of evidenceIds) {
      if (evidenceById[id]) evidence[id] = evidenceById[id];
    }
  }

  const totals = {};
  for (const entry of entries) {
    if (entry.voidedAt) continue;
    for (const [nutrientId, val] of Object.entries(entry.computed || {})) {
      const n = typeof val?.value === "number" ? val.value : parseNumeric(val?.value);
      if (n == null) continue;
      if (!totals[nutrientId]) totals[nutrientId] = { value: 0, unit: String(val?.unit || "") };
      totals[nutrientId].value += n;
      if (!totals[nutrientId].unit) totals[nutrientId].unit = String(val?.unit || "");
    }
  }

  return {
    date: target,
    nutrients: NUTRIENTS,
    entries,
    totals,
    evidence,
  };
}

export async function handleHttpRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;

  try {
    const guardPayload = buildPersistenceGuardPayload({ healthCheck: pathname === "/api/health" });
    if (guardPayload) {
      return json(res, guardPayload.status, guardPayload.body);
    }

    if (req.method === "GET" && pathname === "/api/health") {
      return json(res, 200, {
        status: "ok",
        persistence: {
          kvEnabled: KV_ENABLED,
          blobBackend: KV_ENABLED ? "kv" : "filesystem",
          customDataDir: CUSTOM_DATA_DIR,
          dataDir: DATA_DIR,
        },
      });
    }

    await ensureInit();

    if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      return await serveIndex(res);
    }

    if (req.method === "GET" && pathname.startsWith("/blobs/")) {
      return await serveBlob(req, res, pathname);
    }

    if (req.method === "GET" && pathname === "/api/bootstrap") {
      return json(res, 200, await getBootstrap());
    }

    if (req.method === "GET" && pathname === "/api/evidence") {
      const limit = url.searchParams.get("limit") || "";
      return json(res, 200, await getEvidenceList({ limit }));
    }

    if (req.method === "POST" && pathname === "/api/foods") {
      const body = await readJsonBody(req, { limitBytes: 1_000_000 });
      const food = await createFood(body || {});
      return json(res, 200, { food });
    }

    if (req.method === "GET" && pathname.startsWith("/api/foods/")) {
      const foodId = decodeURIComponent(pathname.replace(/^\/api\/foods\//, ""));
      const view = await getFoodView(foodId);
      if (!view) return json(res, 404, { error: "food not found" });
      return json(res, 200, view);
    }

    if (req.method === "POST" && pathname === "/api/observations") {
      const body = await readJsonBody(req, { limitBytes: 2_000_000 });
      const obs = await createObservation(body || {});
      return json(res, 200, { observation: obs });
    }

    if (req.method === "POST" && pathname === "/api/observations/batch") {
      const body = await readJsonBody(req, { limitBytes: 6_000_000 });
      const created = await createObservationsBatch(body || {});
      return json(res, 200, { observations: created });
    }

    if (req.method === "POST" && pathname === "/api/selections") {
      const body = await readJsonBody(req, { limitBytes: 1_000_000 });
      const result = await setSelection({
        foodId: body.foodId,
        nutrientId: body.nutrientId,
        basis: body.basis,
        toObservationId: body.toObservationId,
        mode: body.mode,
        reason: body.reason,
        by: "user:local",
        fromObservationId: body.fromObservationId || "",
      });
      return json(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/evidence") {
      const body = await readJsonBody(req, { limitBytes: 12_000_000 });
      const created = await createEvidence(body || {});
      return json(res, 200, created);
    }

    if (req.method === "GET" && pathname === "/api/today") {
      const date = url.searchParams.get("date") || "";
      const view = await getTodayView({ date });
      return json(res, 200, view);
    }

    if (req.method === "POST" && pathname === "/api/intakes") {
      const body = await readJsonBody(req, { limitBytes: 2_000_000 });
      const created = await createIntake(body || {});
      return json(res, 200, { intake: created });
    }

    if (req.method === "POST" && pathname === "/api/intakes/patch") {
      const body = await readJsonBody(req, { limitBytes: 2_000_000 });
      const result = await patchIntake({
        intakeId: body.intakeId,
        patch: body.patch,
        reason: body.reason,
      });
      return json(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/intakes/void") {
      const body = await readJsonBody(req, { limitBytes: 1_000_000 });
      const result = await voidIntake({
        intakeId: body.intakeId,
        reason: body.reason,
      });
      return json(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/api/intakes/recalc") {
      const body = await readJsonBody(req, { limitBytes: 1_000_000 });
      const result = await recalcIntake({
        intakeId: body.intakeId,
        basis: body.basis,
      });
      return json(res, 200, result);
    }

    if (req.method === "GET" && pathname === "/api/export") {
      const foods = await readJson(FILES.foods, { version: 1, items: [] });
      const selections = await readJson(FILES.selections, { version: 1, byKey: {} });
      const observations = await readJsonl(FILES.observations);
      const events = await readJsonl(FILES.events);
      const evidence = await readJsonl(FILES.evidence);
      const intakes = await readJsonl(FILES.intakes);
      return json(res, 200, { exportedAt: nowIso(), foods, selections, observations, events, evidence, intakes });
    }

    return text(res, 404, "Not found");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // If we already started streaming a response (e.g. /blobs/*), we cannot
    // send a JSON error body. Just end the connection.
    if (res.headersSent) {
      try {
        res.end();
      } catch {
        // ignore
      }
      return;
    }
    return json(res, 400, { error: message });
  }
}

async function main() {
  if (VERCEL_PERSISTENCE_GUARD) {
    // eslint-disable-next-line no-console
    console.error(PERSISTENCE_GUARD_MESSAGE);
    process.exit(1);
  }
  await ensureInit();

  const port = Number.parseInt(process.env.PORT || "8789", 10);
  const host = String(process.env.HOST || "127.0.0.1");

  const server = http.createServer((req, res) => {
    void handleHttpRequest(req, res);
  });

  server.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });

  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`nutrition-ledger-mvp running: http://${host}:${port}`);
  });
}

const THIS_FILE = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === THIS_FILE) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
