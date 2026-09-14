export const METHOD_PRIORITY = Object.freeze({
  label_verified: 700,
  label_ocr: 600,
  manual_verified: 500,
  manual: 450,
  official_database: 400,
  database: 300,
  derived: 200,
  ai_estimate: 100,
});

export function normalizeConfidence(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  const numeric = Number.parseFloat(String(value));
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(1, numeric));
  const text = String(value).trim();
  return text || null;
}

export function methodPriority(method) {
  return METHOD_PRIORITY[String(method || "")] || 0;
}

export function isApproximateMethod(method) {
  return String(method || "") === "ai_estimate";
}

export function buildProvenanceNote(note, confidence) {
  const normalizedConfidence = normalizeConfidence(confidence);
  return [
    String(note || "").trim(),
    normalizedConfidence === null ? "" : `sourceConfidence=${String(normalizedConfidence)}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function methodLabel(method) {
  const labels = {
    label_verified: "标签已核验",
    label_ocr: "标签 OCR",
    manual_verified: "人工已核验",
    manual: "人工录入",
    official_database: "官方数据库",
    database: "社区/第三方数据库",
    derived: "计算值",
    ai_estimate: "AI 粗估",
  };
  return labels[String(method || "")] || String(method || "未知来源");
}

export function pickPreferredObservation(observations = []) {
  return observations
    .filter(Boolean)
    .slice()
    .sort((a, b) => {
      const priorityDelta = methodPriority(b.method) - methodPriority(a.method);
      if (priorityDelta !== 0) return priorityDelta;
      const aTime = Date.parse(a.createdAt || "") || 0;
      const bTime = Date.parse(b.createdAt || "") || 0;
      return bTime - aTime;
    })[0] || null;
}
