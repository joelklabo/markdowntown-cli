import fs from "node:fs/promises";
import path from "node:path";
import { chromium, Browser } from "playwright";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const componentsScreenshotPath = process.env.E2E_COMPONENTS_SCREENSHOT_PATH;

let browser: Browser;

describe("Section flow", () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  const testTimeout = componentsScreenshotPath ? 45000 : 20000;

  maybe(
    "shows logged-out surfaces and library",
    { timeout: testTimeout },
    async () => {
      await withE2EPage(browser, { baseURL }, async (page) => {
        const home = await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });
        expect(home?.status()).toBeGreaterThanOrEqual(200);
        expect(home?.status()).toBeLessThan(400);
        await page.getByRole("link", { name: /library/i }).first().waitFor({ state: "visible" });
        const buildSection = page.locator("#build-in-60s");
        if ((await buildSection.count()) > 0) {
          await buildSection.waitFor({ state: "visible" });
          await page.locator("#library-preview").waitFor({ state: "visible" });
          await page.getByRole("heading", { name: /reuse a public artifact/i }).waitFor({ state: "visible" });

          if (componentsScreenshotPath) {
            const componentsSection = page.locator("#library-preview");
            await fs.mkdir(path.dirname(componentsScreenshotPath), { recursive: true });
            await componentsSection.screenshot({ path: componentsScreenshotPath });
          }
        } else {
          await page.getByRole("heading", { name: /scan a folder to start/i }).waitFor({ state: "visible" });

          if (componentsScreenshotPath) {
            await fs.mkdir(path.dirname(componentsScreenshotPath), { recursive: true });
            await page.screenshot({ path: componentsScreenshotPath, fullPage: true });
          }
        }

        const library = await page.goto("/library", { waitUntil: "domcontentloaded", timeout: 15000 });
        expect(library?.status()).toBeGreaterThanOrEqual(200);
        expect(library?.status()).toBeLessThan(400);
        await page.getByRole("heading", { name: /library/i }).waitFor({ state: "visible" });

        const builder = await page.goto("/builder", { waitUntil: "domcontentloaded", timeout: 15000 });
        expect(builder?.status()).toBeGreaterThanOrEqual(200);
        expect(builder?.status()).toBeLessThan(400);
        expect(page.url()).toMatch(/\/builder/);
        await page.getByRole("heading", { name: /builder lives inside workbench now/i }).waitFor({ state: "visible" });
        await page.getByRole("link", { name: /open workbench/i }).waitFor({ state: "visible" });
      });
    }
  );
});
