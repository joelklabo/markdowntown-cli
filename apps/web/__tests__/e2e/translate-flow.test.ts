import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const screenshotPath =
  process.env.E2E_SCREENSHOT_PATH || "docs/screenshots/core-flows/translate-workbench-export.png";

describe("Translate flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("selects target, compiles, and downloads outputs", async () => {
    await withE2EPage(
      browser,
      { baseURL, acceptDownloads: true },
      async (page) => {
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);

        await page.goto("/translate", { waitUntil: "domcontentloaded", timeout: 30000 });

        const agentsCheckbox = page.getByRole("checkbox", { name: /agents\.md/i });
        const copilotCheckbox = page.getByRole("checkbox", { name: /github copilot/i });
        await agentsCheckbox.waitFor({ state: "visible", timeout: 20000 });
        expect(await agentsCheckbox.isChecked()).toBe(true);
        expect(await copilotCheckbox.isChecked()).toBe(true);

        const input = page.locator("#translate-input-content");
        await input.waitFor({ state: "visible", timeout: 20000 });
        await input.click();
        await page.keyboard.type("# Translate flow\n\nCompile this into AGENTS.md and Copilot files.");
        await page.getByText(/2 selected/i).waitFor({ state: "visible", timeout: 20000 });

        const compile = page.getByTestId("translate-compile");
        await compile.waitFor({ state: "visible", timeout: 20000 });
        await page.waitForFunction(
          () => {
            const btn = document.querySelector('[data-testid=\"translate-compile\"]') as HTMLButtonElement | null;
            return Boolean(btn && !btn.disabled);
          },
          undefined,
          { timeout: 60000 }
        );

        await Promise.all([
          page.waitForResponse((response) => response.url().includes("/api/compile") && response.status() === 200),
          compile.click(),
        ]);

        await page.getByTestId("translate-ready-actions").waitFor({ state: "visible", timeout: 30000 });
        await page.getByRole("link", { name: /open in workbench/i }).waitFor({ state: "visible", timeout: 20000 });

        if (screenshotPath) {
          await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
          await page.screenshot({ path: screenshotPath, fullPage: true });
        }

        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 30000 }),
          page.getByRole("button", { name: /download zip/i }).click(),
        ]);

        const downloadPath = await download.path();
        expect(downloadPath).toBeTruthy();

        const buffer = await fs.readFile(downloadPath!);
        const zip = await JSZip.loadAsync(buffer);
        const entries = Object.values(zip.files)
          .filter((f) => !f.dir)
          .map((f) => f.name);

        expect(entries).toContain("AGENTS.md");
      },
      "translate-flow"
    );
  }, 120000);
});
