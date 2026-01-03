import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Atlas search flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("navigates to a result from the search input", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/atlas", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /^atlas$/i }).first().waitFor({ state: "visible" });

      const search = page.getByLabel("Search Atlas");
      await search.click();
      await search.fill("scoping");

      await page.getByRole("listbox", { name: /atlas search results/i }).waitFor({ state: "visible" });

      // Exercise keyboard navigation but keep selection on the first result.
      await search.press("ArrowDown");
      await search.press("ArrowUp");
      await search.press("Enter");

      await page.waitForURL(/\/atlas\/concepts\/scoping$/);
      await page.getByRole("heading", { name: /^scoping$/i }).first().waitFor({ state: "visible" });

      expect(page.url()).toMatch(/\/atlas\/concepts\/scoping$/);
    }, "atlas-search");
  });
});

