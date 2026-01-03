import { test, expect } from "@playwright/test";
import { gotoVisualPage } from "./utils";

test.describe("Home page visual", () => {
  test("light mode", async ({ page }) => {
    await gotoVisualPage(page, "/");
    await expect(page).toHaveScreenshot("home-light.png");
  });

  test("dark mode", async ({ page }) => {
    await gotoVisualPage(page, "/", { theme: "dark" });
    await expect(page).toHaveScreenshot("home-dark.png");
  });
});
