import fs from "node:fs/promises";
import path from "node:path";
import { chromium, Browser, type Locator } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const heroScreenshotPath = process.env.E2E_HERO_SCREENSHOT_PATH;
const footerScreenshotPath = process.env.E2E_FOOTER_SCREENSHOT_PATH;

async function captureLocatorScreenshot(locator: Locator, outputPath: string) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await locator.screenshot({ path: outputPath });
}

describe("Site responsive smoke", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("desktop flow: home CTA, nav, library search", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      await Promise.all([
        page.getByRole("banner").waitFor({ state: "visible" }),
        page.getByRole("main").waitFor({ state: "visible" }),
        page.getByRole("contentinfo").waitFor({ state: "visible" }),
      ]);

      const buildSection = page.locator("#build-in-60s");
      const hasFullHome = (await buildSection.count()) > 0;
      if (hasFullHome) {
        await page.getByRole("heading", { name: /a clear, scan-first path/i }).waitFor({ state: "visible" });
        await page.getByRole("heading", { name: /reuse a public artifact/i }).waitFor({ state: "visible" });
        await page.getByRole("heading", { name: /start with a scan/i }).waitFor({ state: "visible" });
      } else {
        await page.getByRole("heading", { name: /scan a folder to start/i }).waitFor({ state: "visible" });
      }

      const scanCta = page.getByRole("link", { name: /^scan a folder$/i }).first();
      const workbenchCta = page.getByRole("link", { name: /^open workbench$/i }).first();
      await scanCta.waitFor({ state: "visible" });
      await workbenchCta.waitFor({ state: "visible" });

      if (heroScreenshotPath) {
        const heroSection = page.locator("main section").first();
        await heroSection.scrollIntoViewIfNeeded();
        await captureLocatorScreenshot(heroSection, heroScreenshotPath);
      }

      if (footerScreenshotPath) {
        const footer = page.getByRole("contentinfo");
        await footer.scrollIntoViewIfNeeded();
        await captureLocatorScreenshot(footer, footerScreenshotPath);
        await page.evaluate(() => window.scrollTo(0, 0));
      }

      const browseLink = page.getByRole("link", { name: /^browse library$/i }).first();

      const headerLibrary = page.locator("header").getByRole("link", { name: /^library$/i });
      if ((await browseLink.count()) > 0) {
        await browseLink.scrollIntoViewIfNeeded();
        await Promise.all([page.waitForURL(/\/library/), browseLink.click()]);
      } else {
        await headerLibrary.first().waitFor({ state: "visible" });
        await Promise.all([page.waitForURL(/\/library/), headerLibrary.first().click()]);
      }

      const header = page.locator("header");
      const searchInput = header.getByRole("textbox", { name: /^search$/i });
      await searchInput.waitFor({ state: "visible" });
      await searchInput.fill("agents");
      const searchButton = header.getByRole("button", { name: /^search$/i });
      await page.waitForTimeout(100);
      await searchButton.click();
      await page.waitForFunction(() => window.location.search.includes("q=agents"));
      expect(page.url()).toMatch(/library\?q=agents/);

      await header.getByRole("link", { name: /^scan$/i }).first().click();
      await page.waitForURL(/\/atlas/);
      await page.getByRole("heading", { name: /^scan a folder$/i }).waitFor({ state: "visible" });
    });
  });

  maybe("mobile flow: home CTA, nav, library search, no overflow", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 360, height: 740 } }, async (page) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      await Promise.all([
        page.getByRole("banner").waitFor({ state: "visible" }),
        page.getByRole("main").waitFor({ state: "visible" }),
        page.getByRole("contentinfo").waitFor({ state: "visible" }),
      ]);

      const buildSection = page.locator("#build-in-60s");
      const hasFullHome = (await buildSection.count()) > 0;
      if (hasFullHome) {
        await page.getByRole("heading", { name: /a clear, scan-first path/i }).waitFor({ state: "visible" });
        await page.getByRole("heading", { name: /reuse a public artifact/i }).waitFor({ state: "visible" });
      } else {
        await page.getByRole("heading", { name: /scan a folder to start/i }).waitFor({ state: "visible" });
      }

      const scanCta = page.getByRole("link", { name: /^scan a folder$/i }).first();
      await scanCta.waitFor({ state: "visible" });

      await scanCta.scrollIntoViewIfNeeded();
      const bottomNav = page.getByRole("navigation", { name: /primary/i }).last();
      await bottomNav.waitFor({ state: "visible" });
      const overlapCheck = await page.evaluate(() => {
        const cta = document.querySelector('a[href="/atlas/simulator"]');
        const nav = Array.from(document.querySelectorAll("nav")).find((el) =>
          (el.getAttribute("aria-label") ?? "").toLowerCase().includes("primary")
        );
        if (!cta || !nav) return null;
        const ctaRect = cta.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        return { ctaBottom: ctaRect.bottom, navTop: navRect.top };
      });
      expect(overlapCheck).toBeTruthy();
      if (overlapCheck) {
        expect(overlapCheck.ctaBottom).toBeLessThan(overlapCheck.navTop + 4);
      }

      const bottomLibrary = bottomNav.getByRole("link", { name: /^library$/i });
      const browseLink = page.getByRole("link", { name: /^browse library$/i }).first();
      if ((await browseLink.count()) > 0) {
        await browseLink.waitFor({ state: "visible" });
        await browseLink.click();
      } else {
        await bottomNav.waitFor({ state: "visible" });
        await bottomLibrary.first().waitFor({ state: "visible" });
        await bottomLibrary.first().click();
      }
      await page.waitForURL(/\/library/);

      const scrollWidth = await page.evaluate(
        () => document.scrollingElement?.scrollWidth ?? document.body.scrollWidth
      );
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 32);

      const docsLink = bottomNav.getByRole("link", { name: /^docs$/i });
      await docsLink.waitFor({ state: "visible" });
      const docsHref = await docsLink.getAttribute("href");
      expect(docsHref).toBe("/docs");

      const scanLink = bottomNav.getByRole("link", { name: /^scan$/i });
      await scanLink.waitFor({ state: "visible" });
      const scanHref = await scanLink.getAttribute("href");
      expect(scanHref).toBe("/atlas/simulator");
      await page.goto(scanHref ?? "/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /^scan a folder$/i }).waitFor({ state: "visible" });
    });
  });
});
