import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Navigation and interaction smoke", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("nav links and search update URL", async () => {
    await withE2EPage(browser, { baseURL }, async (page) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Desktop nav link (avoid hero CTA duplicates)
      await page.locator("header").getByRole("link", { name: /^library$/i }).first().click();
      await page.waitForURL(/\/library/);

      // Library search updates URL
      const searchInput = page.locator("header").getByRole("textbox", { name: /^search$/i });
      await searchInput.click();
      await searchInput.fill("tools");
      const searchButton = page.locator("header").getByRole("button", { name: /^search$/i });
      // React state is async; give it a tick before submit.
      await page.waitForTimeout(100);
      await searchButton.click();
      await page.waitForFunction(() => window.location.search.includes("q=tools"));
      expect(page.url()).toMatch(/library\?q=tools/);

      // Scan link exists and navigates
      await page.locator("header").getByRole("link", { name: /^scan$/i }).first().click();
      await page.waitForURL(/\/atlas/);
      await page.getByRole("heading", { name: /^scan a folder$/i }).waitFor({ state: "visible" });
    });
  }, 45000);
});
