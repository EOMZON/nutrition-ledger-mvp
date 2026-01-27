#!/usr/bin/env node
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import childProcess from "node:child_process";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(APP_DIR, "../..");

const DATA_DIR = path.resolve(process.env.NUTRITION_LEDGER_DATA_DIR || path.join(APP_DIR, "data"));
const LEDGER_DIR = path.join(DATA_DIR, "ledger");
const STATE_DIR = path.join(DATA_DIR, "state");
const BLOBS_DIR = path.join(DATA_DIR, "blobs");

const FILES = {
  indexHtml: path.join(APP_DIR, "index.html"),
  observations: path.join(LEDGER_DIR, "observations.jsonl"),
  events: path.join(LEDGER_DIR, "events.jsonl"),
  evidence: path.join(LEDGER_DIR, "evidence.jsonl"),
  foods: path.join(STATE_DIR, "foods.json"),
  selections: path.join(STATE_DIR, "selections.json"),
};

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

  const ledgerFiles = [FILES.observations, FILES.events, FILES.evidence];
  for (const f of ledgerFiles) {
    if (await fileExists(f)) continue;
    await fs.writeFile(f, "", "utf8");
  }

  if (!(await fileExists(FILES.foods))) {
    await writeJsonAtomic(FILES.foods, { version: 1, updatedAt: nowIso(), items: [] });
  }
  if (!(await fileExists(FILES.selections))) {
    await writeJsonAtomic(FILES.selections, { version: 1, updatedAt: nowIso(), byKey: {} });
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err && typeof err === "object" && err.code === "ENOENT") return fallback;
    return fallback;
  }
}

async function writeJsonAtomic(filePath, value) {
  const tmpPath = `${filePath}.${uuid("tmp")}`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fs.rename(tmpPath, filePath);
}

async function readJsonl(filePath) {
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
  await fs.appendFile(filePath, JSON.stringify(record) + "\n", "utf8");
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

async function detectR2Config() {
  const localEnvPath = path.join(APP_DIR, ".env");
  const localEnv = await readEnvFile(localEnvPath);

  const oldlifeEnvPath = path.join(REPO_ROOT, "8_Workflow/video/OLDLIFEASSONG/.env");
  const oldlifeEnv = await readEnvFile(oldlifeEnvPath);

  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    localEnv.CLOUDFLARE_ACCOUNT_ID ||
    oldlifeEnv.CLOUDFLARE_ACCOUNT_ID ||
    "";
  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN ||
    localEnv.CLOUDFLARE_API_TOKEN ||
    oldlifeEnv.CLOUDFLARE_API_TOKEN ||
    "";
  const bucket =
    process.env.R2_BUCKET ||
    localEnv.R2_BUCKET ||
    localEnv.R2_BUCKET_NAME ||
    oldlifeEnv.R2_BUCKET ||
    oldlifeEnv.R2_BUCKET_NAME ||
    "";
  const publicBase =
    process.env.R2_PUBLIC_BASE_URL ||
    localEnv.R2_PUBLIC_BASE_URL ||
    oldlifeEnv.R2_PUBLIC_BASE_URL ||
    "";

  return {
    available: Boolean(accountId && apiToken && bucket),
    accountId: accountId ? "configured" : "",
    bucket: bucket || "",
    publicBase: publicBase || "",
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
  const localUpload = path.join(APP_DIR, "tools/upload-to-r2.js");
  const oldlifeUpload = path.join(
    REPO_ROOT,
    "8_Workflow/video/OLDLIFEASSONG/TOOLS/cartoon/upload-to-r2.js",
  );
  const uploadScript = (await fileExists(localUpload)) ? localUpload : oldlifeUpload;
  if (!(await fileExists(uploadScript))) throw new Error(`missing upload script: ${uploadScript}`);

  const env = {
    ...process.env,
    R2_KEY_PREFIX: keyPrefix || "nutrition-ledger/evidence",
    R2_KEY_MODE: "basename",
  };

  await new Promise((resolve, reject) => {
    const proc = childProcess.spawn(process.execPath, [uploadScript, filePath], { env });
    proc.stdout.on("data", () => {});
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += String(d)));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr.trim() || `upload-to-r2 exited with code ${code}`));
    });
  });

  const metaPath = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}.json`,
  );
  const meta = await readJson(metaPath, {});
  return {
    url: String(meta.url || "").trim(),
    r2Bucket: String(meta.r2Bucket || "").trim(),
    r2Key: String(meta.r2Key || "").trim(),
  };
}

async function createEvidence({ kind, preview, thumb, ocrText, note, uploadToR2 }) {
  return enqueueWrite(() => createEvidenceNoQueue({ kind, preview, thumb, ocrText, note, uploadToR2 }));
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
  await fs.writeFile(previewPath, previewBuf);
  await fs.writeFile(thumbPath, thumbBuf);

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
    r2: { url: "", r2Bucket: "", r2Key: "" },
    ocrText: String(ocrText || ""),
    note: String(note || ""),
    createdAt,
    createdBy,
    updatedAt: createdAt,
  };

  let uploadError = "";
  if (uploadToR2) {
    try {
      const uploaded = await runUploadToR2(previewPath, { keyPrefix: "nutrition-ledger/evidence" });
      record.r2 = uploaded;
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
  const abs = path.join(BLOBS_DIR, name);
  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile()) return text(res, 404, "Not found");
    const ext = path.extname(abs).toLowerCase();
    const ct = contentTypeForExt(ext);
    res.writeHead(200, { "Content-Type": ct, "Cache-Control": "no-store" });
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    if (err && typeof err === "object" && err.code === "ENOENT") return text(res, 404, "Not found");
    throw err;
  }
}

async function serveIndex(res) {
  try {
    const html = await fs.readFile(FILES.indexHtml, "utf8");
    text(res, 200, html, "text/html; charset=utf-8");
  } catch {
    text(res, 500, "Missing index.html");
  }
}

async function main() {
  await ensureDataFiles();

  const port = Number.parseInt(process.env.PORT || "8789", 10);
  const host = String(process.env.HOST || "127.0.0.1");

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const { pathname } = url;

    try {
      if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
        return await serveIndex(res);
      }

      if (req.method === "GET" && pathname.startsWith("/blobs/")) {
        return await serveBlob(req, res, pathname);
      }

      if (req.method === "GET" && pathname === "/api/bootstrap") {
        return json(res, 200, await getBootstrap());
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

      if (req.method === "GET" && pathname === "/api/export") {
        const foods = await readJson(FILES.foods, { version: 1, items: [] });
        const selections = await readJson(FILES.selections, { version: 1, byKey: {} });
        const observations = await readJsonl(FILES.observations);
        const events = await readJsonl(FILES.events);
        const evidence = await readJsonl(FILES.evidence);
        return json(res, 200, { exportedAt: nowIso(), foods, selections, observations, events, evidence });
      }

      return text(res, 404, "Not found");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json(res, 400, { error: message });
    }
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

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
