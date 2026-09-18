function trimBaseUrl(value) {
  return String(value || "http://127.0.0.1:8789").replace(/\/+$/, "");
}

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof body === "string" ? body : body?.error || JSON.stringify(body);
    throw new Error(`Ledger API ${response.status}: ${detail}`);
  }
  return body;
}

export class LedgerClient {
  constructor(baseUrl = "http://127.0.0.1:8789", { fetchImpl = fetch } = {}) {
    this.baseUrl = trimBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl;
  }

  async request(pathname, options = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
      ...options,
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    return readResponse(response);
  }

  async bootstrap() {
    return this.request("/api/bootstrap");
  }

  async createFood(food) {
    const result = await this.request("/api/foods", {
      method: "POST",
      body: JSON.stringify(food),
    });
    return result.food;
  }

  async getFood(foodId) {
    return this.request(`/api/foods/${encodeURIComponent(foodId)}`);
  }

  async createObservations(observations) {
    if (!Array.isArray(observations) || observations.length === 0) return [];
    const result = await this.request("/api/observations/batch", {
      method: "POST",
      body: JSON.stringify({ observations }),
    });
    return result.observations || [];
  }

  async invalidateObservation({ observationId, reason, evidenceRef = "" }) {
    const result = await this.request("/api/observations/invalidate", {
      method: "POST",
      body: JSON.stringify({ observationId, reason, evidenceRef }),
    });
    return result.event;
  }

  async createIntake(intake) {
    const result = await this.request("/api/intakes", {
      method: "POST",
      body: JSON.stringify(intake),
    });
    return result.intake;
  }

  async today(date = "") {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    return this.request(`/api/today${query}`);
  }
}

function observationKey(item) {
  return [
    item?.nutrientId,
    item?.source,
    item?.sourceId,
    item?.datasetVersion,
    String(item?.value ?? ""),
    item?.unit,
    JSON.stringify(item?.basis || {}),
  ].join("|");
}

export function findEquivalentObservations(view, payloads) {
  const existing = Array.isArray(view?.observations) ? view.observations : [];
  const keys = new Set(existing.map(observationKey));
  return payloads.filter((item) => keys.has(observationKey(item)));
}

export function filterNewObservations(view, payloads) {
  const existingKeys = new Set(
    findEquivalentObservations(view, payloads).map(observationKey),
  );
  return payloads.filter((item) => !existingKeys.has(observationKey(item)));
}
