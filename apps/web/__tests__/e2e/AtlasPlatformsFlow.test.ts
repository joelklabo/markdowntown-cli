import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Atlas platforms flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("navigates from platforms list to a platform detail page", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/atlas/platforms", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /^platforms$/i }).first().waitFor({ state: "visible" });

      const platformLink = page.getByRole("link", { name: /codex cli/i }).first();
      await platformLink.waitFor({ state: "visible" });

      const platformHref = await platformLink.getAttribute("href");
      expect(platformHref).toBe("/atlas/platforms/codex-cli");

      await Promise.all([page.waitForURL(/\/atlas\/platforms\/codex-cli$/), platformLink.click()]);
      await page.getByRole("heading", { name: /^codex cli$/i }).first().waitFor({ state: "visible" });

      const examplesSection = page.locator("section").filter({ hasText: /snippets under atlas\/examples/i }).first();
      await examplesSection.getByText(/^examples$/i).first().waitFor({ state: "visible" });

      await examplesSection.getByRole("button", { name: /copy example/i }).first().waitFor({ state: "visible" });
    }, "atlas-platforms");
  });
});
