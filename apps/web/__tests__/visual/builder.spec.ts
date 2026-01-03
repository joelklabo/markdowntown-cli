import { test, expect } from "@playwright/test";
import { gotoVisualPage } from "./utils";

test.describe("Builder page visual", () => {
  test("light mode", async ({ page }) => {
    await gotoVisualPage(page, "/builder", { theme: "light" });
    await expect(page.getByRole("heading", { name: "Builder lives inside Workbench now" })).toBeVisible();
    await expect(page).toHaveScreenshot("builder-light.png");
  });

  test("dark mode", async ({ page }) => {
    await gotoVisualPage(page, "/builder", { theme: "dark" });
    await expect(page.getByRole("heading", { name: "Builder lives inside Workbench now" })).toBeVisible();
    await expect(page).toHaveScreenshot("builder-dark.png");
  });
});
