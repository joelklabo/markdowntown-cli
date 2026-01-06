import path from "node:path";
import fs from "node:fs/promises";
import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("CLI sync dashboard", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("gates access for unauthenticated users", { timeout: 30000 }, async () => {
    await withE2EPage(browser, { baseURL }, async (page) => {
      await page.goto("/cli");
      await page.waitForURL(/\/signin/);
    }, "cli-sync-auth-gate");
  });

  maybe("renders for authenticated user and captures screenshot", { timeout: 45000 }, async () => {
    await withE2EPage(
      browser,
      { baseURL, viewport: { width: 1280, height: 900 } },
      async (page) => {
        // 1. Sign in
        await page.goto("/signin");
        await page.fill('input[type="password"]', "demo-login");
        await page.click('button:has-text("Demo login")');
        await page.waitForURL("/");

        // 2. Go to CLI dashboard
        await page.goto("/cli", { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: /snapshots and patch queues/i }).waitFor({ state: "visible" });

        const screenshotPath = path.join(
          process.cwd(),
          "docs",
          "screenshots",
          "cli-sync",
          "dashboard.png"
        );
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.waitForTimeout(500);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      },
      "cli-sync-dashboard"
    );
  });
});
