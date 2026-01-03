import { test, expect } from "@playwright/test";
import { gotoVisualPage } from "./utils";

test.describe("Detail pages visual", () => {
  test("artifact desktop", async ({ page }) => {
    await gotoVisualPage(page, "/a/visual-demo");
    await expect(page).toHaveScreenshot("artifact-desktop.png");
  });

  test("artifact mobile", async ({ page }) => {
    await gotoVisualPage(page, "/a/visual-demo");
    await expect(page).toHaveScreenshot("artifact-mobile.png");
  });
});
