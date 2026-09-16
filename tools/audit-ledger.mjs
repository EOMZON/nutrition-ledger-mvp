#!/usr/bin/env node
import path from "node:path";
import { readFile } from "node:fs/promises";

const DATA_DIR = path.resolve(process.env.NUTRITION_LEDGER_DATA_DIR || "data");

async function readText(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function readJson(file, fallback) {
  const raw = await readText(file);
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { __parseError: error.message, __rawFile: file };
  }
}

async function readJsonl(file) {
  const raw = await readText(file);
  const records = [];
  const parseErrors = [];
  for (const [index, line] of raw.split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch (error) {
      parseErrors.push({ line: index + 1, error: error.message });
    }
  }
  return { records, parseErrors };
}

function duplicates(values) {
  const seen = new Set();
  const dup = new Set();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  }
  return [...dup];
}

function pushIssue(issues, code, message, context = {}) {
  issues.push({ code, message, ...context });
}

async function main() {
  const files = {
    foods: path.join(DATA_DIR, "state/foods.json"),
    selections: path.join(DATA_DIR, "state/selections.json"),
    observations: path.join(DATA_DIR, "ledger/observations.jsonl"),
    events: path.join(DATA_DIR, "ledger/events.jsonl"),
    evidence: path.join(DATA_DIR, "ledger/evidence.jsonl"),
    intakes: path.join(DATA_DIR, "ledger/intakes.jsonl"),
  };

  const foodsState = await readJson(files.foods, { version: 1, items: [] });
  const selectionsState = await readJson(files.selections, { version: 1, byKey: {} });
  const observationsFile = await readJsonl(files.observations);
  const eventsFile = await readJsonl(files.events);
  const evidenceFile = await readJsonl(files.evidence);
  const intakesFile = await readJsonl(files.intakes);

  const issues = [];
  if (foodsState.__parseError) pushIssue(issues, "foods_json_invalid", foodsState.__parseError);
  if (selectionsState.__parseError) pushIssue(issues, "selections_json_invalid", selectionsState.__parseError);

  for (const [name, file] of Object.entries({
    observations: observationsFile,
    events: eventsFile,
    evidence: evidenceFile,
    intakes: intakesFile,
  })) {
    for (const error of file.parseErrors) {
      pushIssue(issues, `${name}_jsonl_invalid`, `Invalid JSONL at line ${error.line}`, error);
    }
  }

  const foods = Array.isArray(foodsState.items) ? foodsState.items : [];
  const observations = observationsFile.records;
  const evidence = evidenceFile.records;
  const intakes = intakesFile.records;
  const intakeAdds = intakes.filter((item) => item?.type === "intake.add");

  const foodIds = new Set(foods.map((item) => item?.id).filter(Boolean));
  const observationIds = new Set(observations.map((item) => item?.id).filter(Boolean));
  const evidenceIds = new Set(
    evidence.filter((item) => item?.type === "evidence.create").map((item) => item?.id).filter(Boolean),
  );
  const intakeAddIds = new Set(intakeAdds.map((item) => item?.id).filter(Boolean));

  for (const id of duplicates(foods.map((item) => item?.id))) {
    pushIssue(issues, "duplicate_food_id", `Duplicate food id ${id}`, { id });
  }
  for (const id of duplicates(observations.map((item) => item?.id))) {
    pushIssue(issues, "duplicate_observation_id", `Duplicate observation id ${id}`, { id });
  }
  for (const id of duplicates(intakeAdds.map((item) => item?.id))) {
    pushIssue(issues, "duplicate_intake_id", `Duplicate intake id ${id}`, { id });
  }

  for (const observation of observations) {
    if (!observation?.id) pushIssue(issues, "observation_missing_id", "Observation is missing id");
    if (!String(observation?.source || "").trim()) {
      pushIssue(
        issues,
        "observation_missing_source",
        `Observation ${observation?.id || "(unknown)"} has no source`,
        { observationId: observation?.id },
      );
    }
    if (!String(observation?.method || "").trim()) {
      pushIssue(
        issues,
        "observation_missing_method",
        `Observation ${observation?.id || "(unknown)"} has no method`,
        { observationId: observation?.id },
      );
    }
    if (observation?.foodId && !foodIds.has(observation.foodId)) {
      pushIssue(
        issues,
        "observation_orphan_food",
        `Observation ${observation.id || "(unknown)"} references missing food ${observation.foodId}`,
        { observationId: observation.id, foodId: observation.foodId },
      );
    }
    if (observation?.evidenceId && !evidenceIds.has(observation.evidenceId)) {
      pushIssue(
        issues,
        "observation_missing_evidence",
        `Observation ${observation.id || "(unknown)"} references missing evidence ${observation.evidenceId}`,
        { observationId: observation.id, evidenceId: observation.evidenceId },
      );
    }
  }

  for (const [key, selection] of Object.entries(selectionsState.byKey || {})) {
    const selectedId = selection?.selectedObservationId;
    if (selectedId && !observationIds.has(selectedId)) {
      pushIssue(
        issues,
        "selection_missing_observation",
        `Selection ${key} references missing observation ${selectedId}`,
        { key, observationId: selectedId },
      );
    }
  }

  for (const record of intakes) {
    if (record?.type === "intake.add") {
      if (record.foodId && !foodIds.has(record.foodId)) {
        pushIssue(
          issues,
          "intake_orphan_food",
          `Intake ${record.id || "(unknown)"} references missing food ${record.foodId}`,
          { intakeId: record.id, foodId: record.foodId },
        );
      }
      for (const [nutrientId, per] of Object.entries(record.perBasis || {})) {
        if (per?.observationId && !observationIds.has(per.observationId)) {
          pushIssue(
            issues,
            "intake_missing_snapshot_observation",
            `Intake ${record.id || "(unknown)"} snapshot ${nutrientId} references missing observation ${per.observationId}`,
            { intakeId: record.id, nutrientId, observationId: per.observationId },
          );
        }
      }
      continue;
    }

    if (["intake.patch", "intake.void"].includes(record?.type) && record?.id && !intakeAddIds.has(record.id)) {
      pushIssue(
        issues,
        "intake_event_missing_base",
        `${record.type} references missing intake ${record.id}`,
        { intakeId: record.id },
      );
    }
  }

  const result = {
    ok: issues.length === 0,
    dataDir: DATA_DIR,
    counts: {
      foods: foods.length,
      observations: observations.length,
      selections: Object.keys(selectionsState.byKey || {}).length,
      events: eventsFile.records.length,
      evidenceRecords: evidence.length,
      intakeRecords: intakes.length,
      intakeEntries: intakeAddIds.size,
    },
    issues,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
