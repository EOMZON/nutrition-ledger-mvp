import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 } });

async function browserJson(page, url, { method = "GET", body } = {}) {
  if (page.url() === "about:blank") await page.goto("/");
  return page.evaluate(
    async ({ requestUrl, requestMethod, requestBody }) => {
      const response = await fetch(requestUrl, {
        method: requestMethod,
        headers: requestBody === undefined ? undefined : { "content-type": "application/json" },
        body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
      });
      return { status: response.status, body: await response.json() };
    },
    { requestUrl: url, requestMethod: method, requestBody: body },
  );
}

test("visual evidence: Today P1 is a usable daily entry surface", async ({ page }) => {
  await page.goto("/");
  const suffix = String(Date.now()).slice(-8);
  const label = `视觉验收酸奶 ${suffix}`;
  const created = await browserJson(page, "/api/foods", {
    method: "POST",
    body: { label, barcode: `79${suffix}001`, brand: "Visual P1" },
  });
  const foodId = created.body.food.id;
  await browserJson(page, "/api/observations/batch", {
    method: "POST",
    body: {
      observations: [
        ["energy_kcal", 120, "kcal"],
        ["protein_g", 8, "g"],
        ["fat_g", 4, "g"],
        ["carb_g", 14, "g"],
        ["sugars_g", 9, "g"],
        ["fiber_g", 2, "g"],
      ].map(([nutrientId, value, unit]) => ({
        foodId,
        nutrientId,
        value,
        unit,
        basis: { kind: "per-100g" },
        method: "database",
        source: "visual-fixture",
        sourceId: `visual:${suffix}`,
        datasetVersion: "v1",
      })),
    },
  });
  await browserJson(page, "/api/p1/intakes", {
    method: "POST",
    body: { foodId, amount: { quantity: 150 }, meal: "breakfast" },
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "今天吃了什么？" })).toBeVisible();
  const meals = page.locator("#meal-groups");
  await expect(meals.getByText(label, { exact: true })).toBeVisible();
  await expect(meals.getByRole("heading", { name: "早餐", exact: true })).toBeVisible();
  await expect(page.getByText(/膳食纤维 3 g/)).toBeVisible();

  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/today-p1.png", fullPage: true });
});
