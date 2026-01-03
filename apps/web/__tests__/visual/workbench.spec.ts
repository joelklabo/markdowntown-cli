import { test, expect } from "@playwright/test";
import { gotoVisualPage } from "./utils";

test.describe("Workbench page visual", () => {
  test("light mode", async ({ page }) => {
    await gotoVisualPage(page, "/workbench", { theme: "light" });
    await expect(page.getByLabel("Agent Title")).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(page).toHaveScreenshot("workbench-light.png");
  });

  test("dark mode", async ({ page }) => {
    await gotoVisualPage(page, "/workbench", { theme: "dark" });
    await expect(page.getByLabel("Agent Title")).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(page).toHaveScreenshot("workbench-dark.png");
  });
});
