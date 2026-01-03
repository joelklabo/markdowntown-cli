import { test, expect } from "@playwright/test";
import { gotoVisualPage } from "./utils";

test.describe("Translate page visual", () => {
  test.setTimeout(180000);

  test("light mode", async ({ page }) => {
    await gotoVisualPage(page, "/translate", { theme: "light" });
    await expect(page.getByRole("heading", { name: /translate instructions into workbench-ready files/i }))
      .toBeVisible({ timeout: 30000 });
    await expect(page).toHaveScreenshot("translate-light.png");
  });

  test("dark mode", async ({ page }) => {
    await gotoVisualPage(page, "/translate", { theme: "dark" });
    await expect(page.getByRole("heading", { name: /translate instructions into workbench-ready files/i }))
      .toBeVisible({ timeout: 30000 });
    await expect(page).toHaveScreenshot("translate-dark.png");
  });
});
