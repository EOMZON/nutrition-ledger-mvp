export const NUTRIENT_DEFINITIONS = Object.freeze([
  { id: "energy_kj", label: "能量", unit: "kJ", capture: true },
  { id: "energy_kcal", label: "能量", unit: "kcal", capture: true },
  { id: "protein_g", label: "蛋白质", unit: "g", capture: true },
  { id: "fat_g", label: "脂肪", unit: "g", capture: true },
  { id: "saturated_fat_g", label: "饱和脂肪", unit: "g", capture: true },
  { id: "carb_g", label: "碳水化合物", unit: "g", capture: true },
  { id: "sugars_g", label: "糖", unit: "g", capture: true },
  { id: "fiber_g", label: "膳食纤维", unit: "g", capture: true },
  { id: "sodium_mg", label: "钠", unit: "mg", capture: true },
  { id: "energy_nrv_pct", label: "能量 NRV%", unit: "%", capture: false },
  { id: "protein_nrv_pct", label: "蛋白质 NRV%", unit: "%", capture: false },
  { id: "fat_nrv_pct", label: "脂肪 NRV%", unit: "%", capture: false },
  { id: "saturated_fat_nrv_pct", label: "饱和脂肪 NRV%", unit: "%", capture: false },
  { id: "carb_nrv_pct", label: "碳水化合物 NRV%", unit: "%", capture: false },
  { id: "sugars_nrv_pct", label: "糖 NRV%", unit: "%", capture: false },
  { id: "sodium_nrv_pct", label: "钠 NRV%", unit: "%", capture: false },
]);

export const NUTRIENT_BY_ID = Object.freeze(
  Object.fromEntries(NUTRIENT_DEFINITIONS.map((item) => [item.id, item])),
);

export const CAPTURE_NUTRIENT_IDS = Object.freeze(
  NUTRIENT_DEFINITIONS.filter((item) => item.capture).map((item) => item.id),
);

export const EXTENDED_NUTRIENT_IDS = Object.freeze([
  "saturated_fat_g",
  "sugars_g",
  "fiber_g",
]);

export function normalizeBarcode(input) {
  return String(input ?? "").replace(/[^0-9]/g, "").trim();
}

export function asFiniteNumber(input) {
  if (input === null || input === undefined || input === "") return null;
  const value = typeof input === "number" ? input : Number.parseFloat(String(input));
  return Number.isFinite(value) ? value : null;
}

export function cleanNonNegativeNumber(value, multiplier = 1) {
  const numeric = asFiniteNumber(value);
  if (numeric === null) return null;
  const scaled = numeric * multiplier;
  if (!Number.isFinite(scaled) || scaled < 0) return null;
  return Math.round((scaled + Number.EPSILON) * 10000) / 10000;
}

export function unitForNutrient(nutrientId) {
  return NUTRIENT_BY_ID[nutrientId]?.unit || "";
}

// nutrition-ledger-mvp#35: 值类型边界。观测值可能是单个数值，也可能是
// 估算区间（"260~510" / "260 - 510" / "260–510"）。区间不得被压平成单值
// （旧 parseNumeric 会把 "260~510" 拼成 260510），canonical data model
// 在此表达值类型，projection 再决定展示。
const RANGE_SEPARATOR_RE = /[~～〜﹏–—―]/;
const NUMBER_TOKEN_RE = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

function extractNumberTokens(raw) {
  const tokens = [];
  let match;
  NUMBER_TOKEN_RE.lastIndex = 0;
  while ((match = NUMBER_TOKEN_RE.exec(raw)) !== null) {
    tokens.push({ text: match[0], value: Number.parseFloat(match[0]), index: match.index });
  }
  return tokens;
}

function looksLikeRange(raw, tokens) {
  if (tokens.length !== 2) return false;
  const [a, b] = tokens;
  const between = raw.slice(a.index + a.text.length, b.index);
  if (RANGE_SEPARATOR_RE.test(between)) return true;
  if (/\bto\b/i.test(between)) return true;
  if (between.includes("-")) return true;
  // "260-510"：第二个 token 的前导 "-" 紧贴前一个数字，实际是分隔符而非负号
  if (b.text.startsWith("-") && b.index === a.index + a.text.length) return true;
  return false;
}

function rangeMinMax(tokens) {
  const [a, second] = tokens;
  let lo = a.value;
  let hi = second.value;
  if (second.text.startsWith("-") && second.index === a.index + a.text.length) {
    hi = -hi; // 分隔符连字符不计为负号
  }
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

export function parseNutrientValue(input) {
  if (typeof input === "number") {
    return Number.isFinite(input) ? { kind: "scalar", value: input } : { kind: "unknown" };
  }
  const raw = String(input ?? "").trim();
  if (!raw) return { kind: "unknown" };

  // 千分位逗号先去掉："1,200" 是单值 1200，不是两个数字。
  const normalized = raw.replace(/,/g, "");
  const tokens = extractNumberTokens(normalized);
  if (tokens.length === 0 || tokens.some((t) => !Number.isFinite(t.value))) {
    return { kind: "unknown" };
  }
  if (looksLikeRange(normalized, tokens)) {
    return { kind: "range", ...rangeMinMax(tokens) };
  }
  if (tokens.length === 1) {
    // 单个数值：允许 "260" / "260.5" / "260 kcal" / "约260" 等宽松写法，
    // 但不允许把多个数字拼成一个（"260~510" 已在上面判为 range）。
    const single = Number.parseFloat(normalized.replace(/[^\d.+-eE]/g, ""));
    return Number.isFinite(single) ? { kind: "scalar", value: single } : { kind: "unknown" };
  }
  return { kind: "unknown" };
}

export function todayLocalDate(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error("invalid date");
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
