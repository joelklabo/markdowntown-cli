import { test, expect } from "@playwright/test";
import { gotoVisualPage } from "./utils";

test.describe("Library page visual", () => {
  test("light mode", async ({ page }) => {
    await gotoVisualPage(page, "/library");
    await expect(page).toHaveScreenshot("library-light.png");
  });

  test("dark mode", async ({ page }) => {
    await gotoVisualPage(page, "/library", { theme: "dark" });
    await expect(page).toHaveScreenshot("library-dark.png");
  });
});

test.describe("Browse page visual", () => {
  test("light mode", async ({ page }) => {
    await gotoVisualPage(page, "/browse");
    await expect(page).toHaveScreenshot("browse-light.png");
  });

  test("dark mode", async ({ page }) => {
    await gotoVisualPage(page, "/browse", { theme: "dark" });
    await expect(page).toHaveScreenshot("browse-dark.png");
  });
});
