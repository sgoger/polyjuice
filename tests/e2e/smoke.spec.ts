import { expect, test } from "@playwright/test";

test("la page se charge", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "polyjuice" })).toBeVisible();
});
