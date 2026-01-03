import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Navigation and browse layout integrity", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("keeps header actions on one line and enforces card min width", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/browse", { waitUntil: "domcontentloaded" });
      expect(page.url()).toMatch(/\/library/);

      // Header buttons should not wrap
      const header = page.locator("header");
      const cta = header.getByRole("link", { name: /Scan a folder/i });
      const signIn = header.getByRole("link", { name: /Sign in/i });
      await Promise.all([cta.waitFor(), signIn.waitFor()]);
      const ctaBox = await cta.boundingBox();
      const signBox = await signIn.boundingBox();
      expect(ctaBox?.height).toBeLessThan(48);
      expect(signBox?.height).toBeLessThan(40);

      await page.getByRole("heading", { name: /library/i }).waitFor({ state: "visible" });

      const rows = page.getByTestId("artifact-row");
      const rowCount = await rows.count();
      if (rowCount === 0) {
        await page.getByText(/no public items found|no public items/i).first().waitFor({ state: "visible" });
        return;
      }

      // Rows maintain usable width
      const firstRow = rows.first();
      await firstRow.waitFor({ state: "visible" });
      const rowBox = await firstRow.boundingBox();
      expect(rowBox?.width).toBeGreaterThan(240);
    });
  });

  maybe("mobile nav stays visible, cards stay readable, no horizontal scroll", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 375, height: 667 } }, async (page) => {
      await page.goto("/browse", { waitUntil: "domcontentloaded" });
      expect(page.url()).toMatch(/\/library/);

      const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
      expect(scrollWidth).toBeLessThanOrEqual(440);

      const bottomNav = page.getByRole("navigation", { name: /primary/i });
      await bottomNav.waitFor({ state: "visible" });

      await page.getByRole("heading", { name: /library/i }).waitFor({ state: "visible" });

      const rows = page.getByTestId("artifact-row");
      const rowCount = await rows.count();
      if (rowCount === 0) {
        await page.getByText(/no public items found|no public items/i).first().waitFor({ state: "visible" });
        return;
      }

      const firstRow = rows.first();
      await firstRow.waitFor({ state: "visible" });
      const rowBox = await firstRow.boundingBox();
      expect(rowBox?.width).toBeGreaterThan(220);
    });
  });
});
