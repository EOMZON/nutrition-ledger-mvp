function observationRank(observation) {
  const method = String(observation?.method || "");
  if (method === "label_verified") return 5;
  if (method === "label_ocr") return 4;
  if (method === "manual") return 3;
  if (method === "database") return 2;
  if (method === "derived") return 1;
  return 0;
}

export function buildObservationInvalidationMap(events = []) {
  const map = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || event.type !== "observation.invalidate") continue;
    const observationId = String(event.observationId || "").trim();
    if (!observationId) continue;
    map.set(observationId, {
      eventId: String(event.id || ""),
      observationId,
      reason: String(event.reason || "").trim(),
      evidenceRef: String(event.evidenceRef || "").trim(),
      createdAt: String(event.createdAt || ""),
      createdBy: String(event.createdBy || ""),
    });
  }
  return map;
}

export function annotateObservationValidity(observations = [], events = []) {
  const invalidations = buildObservationInvalidationMap(events);
  return (Array.isArray(observations) ? observations : []).map((observation) => {
    const invalidation = invalidations.get(String(observation?.id || ""));
    if (!invalidation) {
      return {
        ...observation,
        validity: { status: "active" },
      };
    }
    return {
      ...observation,
      validity: {
        status: "invalidated",
        ...invalidation,
      },
    };
  });
}

export function pickDefaultActiveObservation(observations = []) {
  return (Array.isArray(observations) ? observations : [])
    .filter((observation) => observation?.validity?.status !== "invalidated")
    .slice()
    .sort((a, b) => {
      const rankDiff = observationRank(b) - observationRank(a);
      if (rankDiff !== 0) return rankDiff;
      const ta = Date.parse(a?.createdAt || "") || 0;
      const tb = Date.parse(b?.createdAt || "") || 0;
      return tb - ta;
    })[0] || null;
}

export function resolveEffectiveObservation(observations = [], selection = null, events = []) {
  const annotated = annotateObservationValidity(observations, events);
  const selectedId = String(selection?.selectedObservationId || "").trim();

  if (selectedId) {
    const selected = annotated.find((observation) => String(observation?.id || "") === selectedId) || null;
    if (selected?.validity?.status === "invalidated") {
      return {
        observation: null,
        selection: selection || null,
        status: "selected_invalidated",
        invalidatedObservation: selected,
      };
    }
    if (selected) {
      return {
        observation: selected,
        selection: selection || null,
        status: "selected_active",
        invalidatedObservation: null,
      };
    }
  }

  const picked = pickDefaultActiveObservation(annotated);
  if (picked) {
    return {
      observation: picked,
      selection: selection || null,
      status: selectedId ? "selected_missing_defaulted" : "default_active",
      invalidatedObservation: null,
    };
  }

  return {
    observation: null,
    selection: selection || null,
    status: selectedId ? "selected_missing_unresolved" : "unresolved",
    invalidatedObservation: null,
  };
}
