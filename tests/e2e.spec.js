import { test, expect } from "@playwright/test";

const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const barcode = `69${String(Date.now()).slice(-11)}`;
const foodLabel = `发布验证酸奶 ${runId}`;
const readOnly = process.env.E2E_READ_ONLY === "1";

let foodId = "";
let evidencePath = "";

function legacyPath(path = "/") {
  if (path.startsWith("/#")) return `/?legacy=1${path.slice(1)}`;
  if (path === "/") return "/?legacy=1";
  return path;
}

async function gotoApp(page, path = "/") {
  await page.goto(legacyPath(path));
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function browserGet(page, url, { binary = false } = {}) {
  if (page.url() === "about:blank") await gotoApp(page);
  return page.evaluate(
    async ({ requestUrl, asBinary }) => {
      const response = await fetch(requestUrl);
      return {
        status: response.status,
        body: asBinary
          ? (await response.arrayBuffer()).byteLength
          : await response.json(),
      };
    },
    { requestUrl: url, asBinary: binary },
  );
}

test.describe.serial("Nutrition Ledger release scenarios", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
  });

  test("production canary: shell, health, and navigation render", async ({ page }) => {
    const health = await browserGet(page, "/api/health");
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");

    await gotoApp(page, "/#today");
    await expect(page).toHaveTitle(/Nutrition Ledger/);
    await expect(page.getByRole("link", { name: "Today", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Capture", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Evidence", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Foods", exact: true })).toBeVisible();
  });

  test("capture: create food, parse label, freeze an intake snapshot", async ({ page }) => {
    test.skip(readOnly, "production canary is intentionally read-only");

    await gotoApp(page, "/#capture");
    await page.getByRole("button", { name: "新建食物" }).first().click();
    await page.locator("#nf-label").fill(foodLabel);
    await page.locator("#nf-barcode").fill(barcode);
    await page.locator("#nf-brand").fill("Release Gate");
    await page.getByRole("button", { name: "创建" }).click();

    await expect(page.locator("#cap-food")).toHaveValue(/food:barcode:/);
    foodId = await page.locator("#cap-food").inputValue();
    expect(foodId).toContain("food:barcode:");

    // Dogfood regression: adjacent nutrient values without "%" must not become NRV%.
    await page.locator("#cap-text").fill(
      "每100g 能量 539kcal 蛋白质 6.3g 脂肪 30.9g 饱和脂肪 10.6g 碳水化合物 57.5g 糖 56.3g",
    );
    await page.getByRole("button", { name: "解析" }).click();
    await expect(page.locator("#cap-parse-v")).toContainText("protein_g=6.3g");
    await expect(page.locator("#cap-parse-v")).not.toContainText("_nrv_pct=");

    // Explicit percentages remain supported.
    await page.locator("#cap-text").fill(
      "每100g 能量 1500kJ 18% 蛋白质 3.2g 5% 脂肪 5.6g 9% 碳水化合物 10.2g 3% 钠 120mg 6%",
    );
    await page.getByRole("button", { name: "解析" }).click();
    await expect(page.locator("#cap-parse-v")).toContainText("protein_g=3.2g");
    await expect(page.locator("#cap-parse-v")).toContainText("protein_nrv_pct=5%");
    await page.locator("#cap-amt").fill("100");
    await expect(page.locator("#cap-add-today")).toBeChecked();
    await page.getByRole("button", { name: "写入观测" }).click();

    await expect(page).toHaveURL(/#foods$/);
    await expect(page.getByRole("heading", { name: foodLabel })).toBeVisible();
    await expect(page.locator('tr[data-nutrient="protein_g"]')).toContainText("3.2 g");
    await expect(page.locator('tr[data-nutrient="protein_nrv_pct"]')).toContainText("5 %");

    await page.getByRole("link", { name: "Today", exact: true }).click();
    await expect(page.locator("#today-entries")).toContainText(foodLabel);
    await expect(page.locator("#today-entries")).toContainText("P 3.2");
  });

  test("evidence: upload, list, reload, and read the persisted image", async ({ page }) => {
    test.skip(readOnly, "production canary is intentionally read-only");

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
      "base64",
    );

    await gotoApp(page, "/#capture");
    await page.locator("#cap-food").selectOption(foodId);
    await page.locator("#cap-ev-file").setInputFiles({
      name: `nutrition-${runId}.png`,
      mimeType: "image/png",
      buffer: png,
    });
    await page.locator("#cap-ev-note").fill(`release evidence ${runId}`);
    await page.getByRole("button", { name: "保存证据" }).click();
    await expect(page.locator("#cap-ev-preview .v")).toContainText("ev_");

    await page.getByRole("link", { name: "Evidence", exact: true }).click();
    await expect(page.locator("#evidence-list")).toContainText(`release evidence ${runId}`);
    const image = page.locator("#evidence-list img").first();
    await expect(image).toBeVisible();
    evidencePath = await image.getAttribute("src");
    expect(evidencePath).toBeTruthy();

    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    const blobResponse = await browserGet(page, evidencePath, { binary: true });
    expect(blobResponse.status).toBe(200);
    expect(blobResponse.body).toBeGreaterThan(0);
  });

  test("history and Today: edit, source switch, frozen snapshot, recalc, resize, void", async ({ page }) => {
    test.skip(readOnly, "production canary is intentionally read-only");

    await gotoApp(page, "/#foods");
    await page.locator("#food-search").fill(foodLabel);
    await page.getByText(foodLabel, { exact: true }).first().click();
    const proteinRow = page.locator('tr[data-nutrient="protein_g"]');

    await proteinRow.getByRole("button", { name: "改值" }).click();
    await page.locator("#edit-value").fill("4.0");
    await page.locator("#edit-note").fill("release source override");
    await page.getByRole("button", { name: "保存（追加记录）" }).click();
    await expect(proteinRow).toContainText("4.0 g");

    await proteinRow.getByRole("button", { name: "历史" }).click();
    await page.getByRole("button", { name: "回滚到最初" }).click();
    await expect(proteinRow).toContainText("3.2 g");

    await proteinRow.getByRole("button", { name: "历史" }).click();
    await page.locator('button[data-use]:not([disabled])').click();
    await expect(proteinRow).toContainText("4.0 g");

    await page.getByRole("link", { name: "Today", exact: true }).click();
    const entry = page.locator("#today-entries .history-item").filter({ hasText: foodLabel }).first();
    await expect(entry).toContainText("P 3.2");

    await entry.getByRole("button", { name: "重算" }).click();
    await expect(entry).toContainText("P 4");

    await entry.getByRole("button", { name: "改量" }).click();
    await page.locator("#ie-amt").fill("50");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(entry).toContainText("P 2");

    await entry.getByRole("button", { name: "撤销" }).click();
    await expect(page.locator("#today-count")).toContainText("0 entries");
  });

  test("correction: invalidation preserves history and makes selected value unresolved", async ({ page }) => {
    test.skip(readOnly, "production canary is intentionally read-only");

    await gotoApp(page, "/#foods");
    await page.locator("#food-search").fill(foodLabel);
    await page.getByText(foodLabel, { exact: true }).first().click();

    const before = await browserGet(page, `/api/foods/${encodeURIComponent(foodId)}`);
    const selectedProtein = Object.values(before.body.effective || {}).find(
      (hit) => hit?.observation?.nutrientId === "protein_g",
    );
    expect(selectedProtein?.observation?.id).toBeTruthy();

    const invalidation = await page.evaluate(
      async ({ observationId }) => {
        const response = await fetch("/api/observations/invalidate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            observationId,
            reason: "e2e_parser_bug",
            evidenceRef: "fixture:e2e",
          }),
        });
        return { status: response.status, body: await response.json() };
      },
      { observationId: selectedProtein.observation.id },
    );
    expect(invalidation.status).toBe(200);
    expect(invalidation.body.event.type).toBe("observation.invalidate");

    const after = await browserGet(page, `/api/foods/${encodeURIComponent(foodId)}`);
    const proteinEffective = Object.values(after.body.effective || {}).find(
      (hit) =>
        hit?.invalidatedObservation?.nutrientId === "protein_g" ||
        hit?.observation?.nutrientId === "protein_g",
    );
    expect(proteinEffective?.status).toBe("selected_invalidated");
    expect(proteinEffective?.observation).toBeNull();

    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await page.locator("#food-search").fill(foodLabel);
    await page.getByText(foodLabel, { exact: true }).first().click();

    const proteinRow = page.locator('tr[data-nutrient="protein_g"]');
    await expect(proteinRow).toContainText("—");
    await proteinRow.getByRole("button", { name: "历史" }).click();
    const invalidatedItem = page.locator(".history-item").filter({ hasText: "invalidated" }).first();
    await expect(invalidatedItem).toContainText("e2e_parser_bug");
    await expect(invalidatedItem.getByRole("button", { name: "使用此值" })).toBeDisabled();
  });

  test("export: append-only records remain explainable", async ({ page }) => {
    test.skip(readOnly, "production canary is intentionally read-only");

    const response = await browserGet(page, "/api/export");
    expect(response.status).toBe(200);
    const exported = response.body;
    expect(exported.foods.items.some((food) => food.id === foodId)).toBeTruthy();
    expect(exported.observations.filter((item) => item.foodId === foodId).length).toBeGreaterThanOrEqual(10);
    expect(exported.events.filter((item) => item.foodId === foodId).length).toBeGreaterThanOrEqual(10);
    expect(exported.evidence.some((item) => item.note === `release evidence ${runId}`)).toBeTruthy();
    const intake = exported.intakes.find((item) => item.foodId === foodId && item.type === "intake.add");
    expect(intake).toBeTruthy();
    expect(exported.intakes.some((item) => item.id === intake.id && item.type === "intake.void")).toBeTruthy();
  });
});
