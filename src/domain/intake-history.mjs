import { extractMealFromNote, mealLabel, normalizeMeal } from "./meals.mjs";

function deepMerge(base, ...patches) {
  const out = Array.isArray(base) ? base.slice() : { ...(base || {}) };
  for (const patch of patches) {
    if (!patch || typeof patch !== "object") continue;
    for (const [key, value] of Object.entries(patch)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        out[key] = deepMerge(out[key], value);
      } else {
        out[key] = value;
      }
    }
  }
  return out;
}

export function mergeIntakeRecords(records = []) {
  const byId = {};
  for (const record of Array.isArray(records) ? records : []) {
    if (!record || typeof record !== "object") continue;
    const id = String(record.id || "").trim();
    if (!id) continue;

    if (record.type === "intake.add") {
      byId[id] = { ...record };
      continue;
    }

    if (record.type === "intake.patch" && record.patch && typeof record.patch === "object") {
      const base = byId[id] || { id, type: "intake.add" };
      byId[id] = deepMerge(base, record.patch, {
        updatedAt: record.createdAt || base.updatedAt || base.createdAt || "",
      });
      continue;
    }

    if (record.type === "intake.void") {
      const base = byId[id] || { id, type: "intake.add" };
      byId[id] = deepMerge(base, {
        voidedAt: record.createdAt || "",
        voidedReason: String(record.reason || ""),
        updatedAt: record.createdAt || base.updatedAt || base.createdAt || "",
      });
    }
  }
  return byId;
}

export function intakeMeal(entry) {
  return normalizeMeal(entry?.meal) || extractMealFromNote(entry?.note, "other");
}

function shortcutFromEntry(entry, food, count) {
  const meal = intakeMeal(entry);
  return {
    foodId: String(entry?.foodId || ""),
    title: String(food?.label || entry?.foodLabel || "未命名食物"),
    brand: String(food?.brand || ""),
    count,
    lastIntakeId: String(entry?.id || ""),
    lastConsumedAt: String(entry?.consumedAt || entry?.createdAt || ""),
    amount: entry?.amount || null,
    basis: entry?.basis || null,
    meal,
    mealLabel: mealLabel(meal),
  };
}

export function deriveFoodShortcuts(
  intakeRecords,
  foods = [],
  { recentLimit = 6, commonLimit = 6, commonWindowDays = 30, now = new Date() } = {},
) {
  const merged = mergeIntakeRecords(intakeRecords);
  const foodsById = Object.fromEntries(
    (Array.isArray(foods) ? foods : []).map((food) => [String(food?.id || ""), food]),
  );

  const active = Object.values(merged)
    .filter((entry) => entry && typeof entry === "object" && !entry.voidedAt && entry.foodId)
    .sort(
      (a, b) =>
        (Date.parse(b.consumedAt || b.createdAt || "") || 0) -
        (Date.parse(a.consumedAt || a.createdAt || "") || 0),
    );

  const stats = new Map();
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const cutoffMs = Number.isFinite(nowMs)
    ? nowMs - commonWindowDays * 24 * 60 * 60 * 1000
    : Number.NEGATIVE_INFINITY;

  for (const entry of active) {
    const foodId = String(entry.foodId);
    const timestamp = Date.parse(entry.consumedAt || entry.createdAt || "") || 0;
    const current = stats.get(foodId) || {
      foodId,
      latest: entry,
      recentCount: 0,
      allCount: 0,
    };
    current.allCount += 1;
    if (timestamp >= cutoffMs) current.recentCount += 1;
    if (
      (Date.parse(entry.consumedAt || entry.createdAt || "") || 0) >
      (Date.parse(current.latest?.consumedAt || current.latest?.createdAt || "") || 0)
    ) {
      current.latest = entry;
    }
    stats.set(foodId, current);
  }

  const recent = [...stats.values()]
    .sort(
      (a, b) =>
        (Date.parse(b.latest?.consumedAt || b.latest?.createdAt || "") || 0) -
        (Date.parse(a.latest?.consumedAt || a.latest?.createdAt || "") || 0),
    )
    .slice(0, recentLimit)
    .map((item) => shortcutFromEntry(item.latest, foodsById[item.foodId], item.recentCount || item.allCount));

  const common = [...stats.values()]
    .filter((item) => item.recentCount > 0)
    .sort((a, b) => {
      if (a.recentCount !== b.recentCount) return b.recentCount - a.recentCount;
      return (
        (Date.parse(b.latest?.consumedAt || b.latest?.createdAt || "") || 0) -
        (Date.parse(a.latest?.consumedAt || a.latest?.createdAt || "") || 0)
      );
    })
    .slice(0, commonLimit)
    .map((item) => shortcutFromEntry(item.latest, foodsById[item.foodId], item.recentCount));

  return { recent, common, merged };
}
