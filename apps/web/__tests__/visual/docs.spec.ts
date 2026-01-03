import { test, expect } from "@playwright/test";
import { gotoVisualPage } from "./utils";

const pages = [
  { name: "docs", url: "/docs" },
  { name: "changelog", url: "/changelog" },
  { name: "privacy", url: "/privacy" },
  { name: "terms", url: "/terms" },
];

test.describe("Docs/legal visuals", () => {
  for (const { name, url } of pages) {
    test(`${name} light`, async ({ page }) => {
      await gotoVisualPage(page, url, { theme: "light" });
      await expect(page).toHaveScreenshot(`${name}-light.png`);
    });

    test(`${name} dark`, async ({ page }) => {
      await gotoVisualPage(page, url, { theme: "dark" });
      await expect(page).toHaveScreenshot(`${name}-dark.png`);
    });
  }
});
