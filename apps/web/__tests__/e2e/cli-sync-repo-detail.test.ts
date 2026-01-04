import path from "node:path";
import fs from "node:fs/promises";
import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("CLI sync repo detail", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("cli-sync-repo-detail renders and captures screenshot", { timeout: 45000 }, async () => {
    await withE2EPage(
      browser,
      { baseURL, viewport: { width: 1400, height: 900 } },
      async (page) => {
        await page.goto("/cli/markdowntown-cli", { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: /markdowntown cli/i }).waitFor({ state: "visible" });
        await page.getByText(/snapshot files/i).waitFor({ state: "visible" });
        await page.getByText(/audit issues/i).waitFor({ state: "visible" });

        const screenshotPath = path.join(
          process.cwd(),
          "..",
          "..",
          "docs",
          "screenshots",
          "cli-sync",
          "repo-detail.png"
        );
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.waitForTimeout(500);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      },
      "cli-sync-repo-detail"
    );
  });
});
