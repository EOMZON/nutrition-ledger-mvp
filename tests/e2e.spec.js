import { test, expect } from "@playwright/test";

test("nutrition ledger: create food → import label → edit → rollback", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#kpi-data")).not.toHaveText("—");

  await page.getByRole("button", { name: "新建食物" }).click();
  await page.locator("#nf-label").fill("测试饼干");
  await page.locator("#nf-barcode").fill("6901234567890");
  await page.locator("#nf-brand").fill("Demo");
  await page.getByRole("button", { name: "创建" }).click();

  await expect(page.getByRole("heading", { name: "测试饼干" })).toBeVisible();

  await page.locator("#label-text").fill(
    "每100g 能量 1500kJ 18% 蛋白质 3.2g 5% 脂肪 5.6g 9% 碳水化合物 10.2g 3% 钠 120mg 6%",
  );
  await page.getByRole("button", { name: "解析" }).click();
  await expect(page.locator("#parse-preview")).toContainText("protein_g=3.2g");
  await page.getByRole("button", { name: "写入观测" }).click();

  const proteinRow = page.locator('tr[data-nutrient="protein_g"]');
  await expect(proteinRow).toContainText("3.2 g");

  const proteinNrvRow = page.locator('tr[data-nutrient="protein_nrv_pct"]');
  await expect(proteinNrvRow).toContainText("5 %");

  await proteinRow.getByRole("button", { name: "改值" }).click();
  await page.locator("#edit-value").fill("4.0");
  await page.getByRole("button", { name: "保存（追加记录）" }).click();

  await expect(proteinRow).toContainText("4.0 g");

  await proteinRow.getByRole("button", { name: "历史" }).click();
  await page.getByRole("button", { name: "回滚到最初" }).click();

  await expect(proteinRow).toContainText("3.2 g");
});
