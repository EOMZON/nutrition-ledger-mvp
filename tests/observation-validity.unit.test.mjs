import test from "node:test";
import assert from "node:assert/strict";
import {
  annotateObservationValidity,
  buildObservationInvalidationMap,
  pickDefaultActiveObservation,
  resolveEffectiveObservation,
} from "../src/domain/observation-validity.mjs";

const basis = { kind: "per-100g" };

function observation(id, value, method, createdAt) {
  return {
    id,
    foodId: "food:test",
    nutrientId: "protein_g",
    value,
    unit: "g",
    basis,
    method,
    source: "user",
    createdAt,
  };
}

test("invalidation events annotate observations without deleting history", () => {
  const observations = [
    observation("obs-old", "30.9", "label_ocr", "2026-09-17T00:00:00Z"),
    observation("obs-new", "6.3", "label_verified", "2026-09-18T00:00:00Z"),
  ];
  const events = [
    {
      type: "observation.invalidate",
      id: "evt-invalid",
      observationId: "obs-old",
      reason: "parser_bug",
      evidenceRef: "issue:19",
      createdAt: "2026-09-18T01:00:00Z",
    },
  ];

  const map = buildObservationInvalidationMap(events);
  assert.equal(map.get("obs-old").reason, "parser_bug");

  const annotated = annotateObservationValidity(observations, events);
  assert.equal(annotated.length, 2);
  assert.equal(annotated[0].validity.status, "invalidated");
  assert.equal(annotated[0].validity.evidenceRef, "issue:19");
  assert.equal(annotated[1].validity.status, "active");
});

test("default resolver never picks invalidated observations", () => {
  const observations = annotateObservationValidity(
    [
      observation("obs-bad", "30.9", "label_verified", "2026-09-18T02:00:00Z"),
      observation("obs-good", "6.3", "manual", "2026-09-17T02:00:00Z"),
    ],
    [
      {
        type: "observation.invalidate",
        id: "evt-invalid",
        observationId: "obs-bad",
        reason: "parser_bug",
      },
    ],
  );

  const picked = pickDefaultActiveObservation(observations);
  assert.equal(picked.id, "obs-good");
});

test("selected invalidated observation becomes explicit unresolved state", () => {
  const observations = [
    observation("obs-bad", "30.9", "label_ocr", "2026-09-17T00:00:00Z"),
    observation("obs-good", "6.3", "manual", "2026-09-18T00:00:00Z"),
  ];
  const selection = { selectedObservationId: "obs-bad", mode: "pinned" };
  const events = [
    {
      type: "observation.invalidate",
      id: "evt-invalid",
      observationId: "obs-bad",
      reason: "parser_bug",
    },
  ];

  const resolved = resolveEffectiveObservation(observations, selection, events);
  assert.equal(resolved.status, "selected_invalidated");
  assert.equal(resolved.observation, null);
  assert.equal(resolved.invalidatedObservation.id, "obs-bad");
});

test("active pinned selection remains effective", () => {
  const observations = [
    observation("obs-1", "3.2", "label_ocr", "2026-09-17T00:00:00Z"),
    observation("obs-2", "4.0", "manual", "2026-09-18T00:00:00Z"),
  ];
  const selection = { selectedObservationId: "obs-2", mode: "pinned" };

  const resolved = resolveEffectiveObservation(observations, selection, []);
  assert.equal(resolved.status, "selected_active");
  assert.equal(resolved.observation.id, "obs-2");
});
