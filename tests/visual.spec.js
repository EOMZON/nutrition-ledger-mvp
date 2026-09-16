import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 } });

async function gotoApp(page, path) {
  await page.goto(path);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test("visual evidence: Today remains usable after architecture refactor", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  await gotoApp(page, "/#capture");
  await page.getByRole("button", { name: "新建食物" }).first().click();
  await page.locator("#nf-label").fill("演示燕麦杯");
  await page.locator("#nf-barcode").fill("6901234567890");
  await page.locator("#nf-brand").fill("Demo");
  await page.getByRole("button", { name: "创建" }).click();

  await page.locator("#cap-text").fill(
    "每100g 能量 1680kJ 20% 蛋白质 12.5g 21% 脂肪 9.2g 15% 碳水化合物 61g 20% 钠 320mg 16%",
  );
  await page.getByRole("button", { name: "解析" }).click();
  await page.locator("#cap-amt").fill("40");
  await page.getByRole("button", { name: "写入观测" }).click();

  await expect(page).toHaveURL(/#foods$/);
  await expect(page.getByRole("heading", { name: "演示燕麦杯" })).toBeVisible();

  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/#today$/);
  await expect(page.locator("#today-entries")).toContainText("演示燕麦杯");

  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/today-daily-v1.png",
    fullPage: true,
  });
});
