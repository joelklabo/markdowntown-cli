import fs from "node:fs/promises";
import path from "node:path";
import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const screenshotPath = process.env.E2E_SCREENSHOT_PATH;

describe("Landing primary flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("desktop: CTA hierarchy + nav destinations", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      await Promise.all([
        page.getByRole("banner").waitFor({ state: "visible" }),
        page.locator("#main-content").waitFor({ state: "visible" }),
        page.getByRole("contentinfo").waitFor({ state: "visible" }),
      ]);

      const heroCard = page.locator("section").filter({ has: page.getByText("Start with scan") }).first();
      const hasHeroCard = (await heroCard.count()) > 0;
      const emptyStateHeading = page.getByRole("heading", { name: /scan a folder to start/i }).first();

      if (hasHeroCard) {
        const scanCta = heroCard.getByRole("link", { name: /^scan a folder$/i }).first();
        const workbenchCta = heroCard.getByRole("link", { name: /^open workbench$/i }).first();
        await scanCta.waitFor({ state: "visible" });
        await workbenchCta.waitFor({ state: "visible" });

        const scanIndex = await scanCta.evaluate((node) => {
          const parent = (node as HTMLElement).parentElement;
          return Array.from(parent?.querySelectorAll("a") ?? []).indexOf(node as HTMLAnchorElement);
        });
        const workbenchIndex = await workbenchCta.evaluate((node) => {
          const parent = (node as HTMLElement).parentElement;
          return Array.from(parent?.querySelectorAll("a") ?? []).indexOf(node as HTMLAnchorElement);
        });
        expect(scanIndex).toBeGreaterThanOrEqual(0);
        expect(workbenchIndex).toBeGreaterThanOrEqual(0);
        expect(scanIndex).toBeLessThan(workbenchIndex);
      } else {
        await emptyStateHeading.waitFor({ state: "visible" });
        const scanCta = page.getByRole("link", { name: /^scan a folder$/i }).first();
        const workbenchCta = page.getByRole("link", { name: /^open workbench$/i }).first();
        await scanCta.waitFor({ state: "visible" });
        await workbenchCta.waitFor({ state: "visible" });
      }

      const header = page.locator("header");
      const navLinks = ["Scan", "Workbench", "Library", "Translate", "Docs"];
      for (const label of navLinks) {
        await header.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first().waitFor({ state: "visible" });
      }

      if (screenshotPath) {
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }
    }, "landing-primary-flow");
  });

  maybe("mobile: core CTA still visible", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 360, height: 740 } }, async (page) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.locator("#main-content").waitFor({ state: "visible" });

      const scanCta = page.getByRole("link", { name: /^scan a folder$/i }).first();
      const workbenchCta = page.getByRole("link", { name: /^open workbench$/i }).first();
      await scanCta.waitFor({ state: "visible" });
      await workbenchCta.waitFor({ state: "visible" });
    }, "landing-primary-flow-mobile");
  });
});
