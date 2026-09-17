import { test, expect } from "@playwright/test";

const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const foodLabel = `P1 藜麦碗 ${runId}`;
const barcode = `88${String(Date.now()).slice(-11)}`;
let foodId = "";
let firstIntakeId = "";

async function browserJson(page, url, { method = "GET", body } = {}) {
  if (page.url() === "about:blank") await page.goto("/");
  return page.evaluate(
    async ({ requestUrl, requestMethod, requestBody }) => {
      const response = await fetch(requestUrl, {
        method: requestMethod,
        headers: requestBody === undefined ? undefined : { "content-type": "application/json" },
        body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
      });
      const payload = await response.json().catch(() => ({}));
      return { status: response.status, body: payload };
    },
    { requestUrl: url, requestMethod: method, requestBody: body },
  );
}

test.describe.serial("Nutrition Today P1 daily loop", () => {
  test("Today is the default entry surface", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Nutrition Today");
    await expect(page.getByRole("heading", { name: "今天吃了什么？" })).toBeVisible();
    await expect(page.getByRole("link", { name: "完整工作台" })).toHaveAttribute("href", "/?legacy=1");
  });

  test("meal is first-class and extended nutrients/provenance reach Today", async ({ page }) => {
    await page.goto("/");

    const foodResponse = await browserJson(page, "/api/foods", {
      method: "POST",
      body: { label: foodLabel, barcode, brand: "P1 Fixture", kind: "prepared" },
    });
    expect(foodResponse.status).toBe(200);
    foodId = foodResponse.body.food.id;

    const source = {
      method: "ai_estimate",
      source: "p1-fixture-ai",
      sourceId: `fixture:${runId}`,
      datasetVersion: "fixture-v1",
      basis: { kind: "per-100g" },
    };
    const nutrientRows = [
      ["energy_kcal", 220, "kcal"],
      ["protein_g", 14, "g"],
      ["fat_g", 8, "g"],
      ["saturated_fat_g", 2, "g"],
      ["carb_g", 26, "g"],
      ["sugars_g", 4, "g"],
      ["fiber_g", 8, "g"],
      ["sodium_mg", 300, "mg"],
    ];
    const observationResponse = await browserJson(page, "/api/observations/batch", {
      method: "POST",
      body: {
        observations: nutrientRows.map(([nutrientId, value, unit]) => ({
          foodId,
          nutrientId,
          value,
          unit,
          ...source,
        })),
      },
    });
    expect(observationResponse.status).toBe(200);

    const intakeResponse = await browserJson(page, "/api/p1/intakes", {
      method: "POST",
      body: {
        foodId,
        amount: { quantity: 50 },
        meal: "lunch",
        note: "P1 行为测试",
      },
    });
    expect(intakeResponse.status).toBe(200);
    expect(intakeResponse.body.intake.meal).toBe("lunch");
    expect(intakeResponse.body.intake.computed.fiber_g.value).toBe(4);
    expect(intakeResponse.body.intake.computed.saturated_fat_g.value).toBe(1);
    firstIntakeId = intakeResponse.body.intake.id;

    await page.reload();
    const meals = page.locator("#meal-groups");
    await expect(meals.getByText(foodLabel, { exact: true })).toBeVisible();
    await expect(meals.getByRole("heading", { name: "午餐", exact: true })).toBeVisible();
    await expect(meals.getByText(/AI 粗估/).first()).toBeVisible();
    await expect(page.getByText(/膳食纤维 4 g/)).toBeVisible();
  });

  test("one-click repeat creates a new append-only intake", async ({ page }) => {
    await page.goto("/");
    const before = await browserJson(page, "/api/p1/today");
    const beforeCount = before.body.entryCount;

    const button = page.locator(`[data-repeat="${firstIntakeId}"]`).first();
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator("#today-count")).toContainText(`${beforeCount + 1} 条记录`);

    const exported = await browserJson(page, "/api/export");
    const adds = exported.body.intakes.filter(
      (item) => item.type === "intake.add" && item.foodId === foodId,
    );
    expect(adds.length).toBeGreaterThanOrEqual(2);
    expect(adds.some((item) => item.id === firstIntakeId)).toBeTruthy();
  });

  test("existing food quick-add can create a new meal entry", async ({ page }) => {
    await page.goto("/");
    await page.locator("#quick-food").selectOption(foodId);
    await page.locator("#quick-amount").fill("25");
    await page.locator("#quick-meal").selectOption("dinner");
    await page.getByRole("button", { name: "加入 Today" }).click();
    await expect(page.locator("#meal-groups").getByRole("heading", { name: "晚餐", exact: true })).toBeVisible();
    const today = await browserJson(page, "/api/p1/today");
    const dinner = today.body.groups.find((group) => group.meal === "dinner");
    expect(dinner?.entries.some((entry) => entry.foodId === foodId)).toBeTruthy();
  });

  test("barcode lookup UI shows traceable provider preview without browser-side provider logic", async ({ page }) => {
    await page.route("**/api/p1/barcode?barcode=*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          candidate: {
            food: { label: "条码演示食品", brand: "Demo", barcode: "3017620422003" },
            nutrients: [
              { nutrientId: "energy_kcal", value: 539, unit: "kcal" },
              { nutrientId: "sugars_g", value: 56.3, unit: "g" },
              { nutrientId: "fiber_g", value: 0, unit: "g" },
            ],
            source: { name: "openfoodfacts", method: "database" },
          },
        }),
      });
    });
    await page.goto("/");
    await page.locator("#barcode").fill("3017620422003");
    await page.getByRole("button", { name: "查询条码" }).click();
    await expect(page.locator("#barcode-preview")).toContainText("条码演示食品");
    await expect(page.locator("#barcode-preview")).toContainText("Open Food Facts");
    await expect(page.getByRole("button", { name: "确认并加入 Today" })).toBeEnabled();
  });
});
