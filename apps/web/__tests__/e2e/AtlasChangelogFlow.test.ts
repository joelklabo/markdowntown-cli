import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Atlas changelog flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("opens an entry and navigates to an impacted platform", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/atlas/changelog", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /^changelog$/i }).first().waitFor({ state: "visible" });

      const entryLink = page.locator('a[href^="/atlas/changelog/"]').first();
      const entryHref = await entryLink.getAttribute("href");
      expect(entryHref).toMatch(/^\/atlas\/changelog\/.+/);
      if (!entryHref) throw new Error("Changelog entry link is missing an href.");

      await Promise.all([page.waitForURL((url) => url.pathname === entryHref), entryLink.click()]);

      await page.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });

      const impactedSection = page.locator("section").filter({ hasText: /impacted claims/i }).first();
      await impactedSection.getByText(/^impacted claims$/i).first().waitFor({ state: "visible" });

      const platformLink = impactedSection.locator('a[href^="/atlas/platforms/"]').first();
      await platformLink.waitFor({ state: "visible" });

      const platformHref = await platformLink.getAttribute("href");
      expect(platformHref).toMatch(/^\/atlas\/platforms\/[^/]+$/);
      if (!platformHref) throw new Error("Impacted claim platform link is missing an href.");

      await Promise.all([page.waitForURL((url) => url.pathname === platformHref), platformLink.click()]);
      await page.getByRole("heading").first().waitFor({ state: "visible" });

      expect(page.url()).toMatch(new RegExp(`${platformHref}$`));
    }, "atlas-changelog");
  });
});
