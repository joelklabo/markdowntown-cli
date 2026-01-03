import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";
import fs from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const screenshotPath = process.env.E2E_SCREENSHOT_PATH;
const exportScreenshotPath = process.env.E2E_EXPORT_SCREENSHOT_PATH;

describe("Workbench onboarding", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("shows first-run guidance without scan context", async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/workbench", { waitUntil: "domcontentloaded" });

      await page.getByTestId("workbench-scopes-panel").waitFor({ state: "visible" });
      await page.getByRole("heading", { name: /build your agents\.md/i }).waitFor({ state: "visible" });
      await page.getByText(/no scan context yet/i).waitFor({ state: "visible" });
      const main = page.locator("#main-content");
      await main.getByRole("link", { name: /scan a folder/i }).first().waitFor({ state: "visible" });

      if (screenshotPath) {
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }
    });
  }, 45000);

  maybe("exports AGENTS.md and shows success status", async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/workbench", { waitUntil: "domcontentloaded" });

      const scopesPanel = page.getByTestId("workbench-scopes-panel");
      await scopesPanel.waitFor({ state: "visible" });

      await page.getByRole("button", { name: /add scope/i }).click();
      await page.getByLabel("Scope glob pattern").fill("README.md");
      await page.getByRole("button", { name: /^add$/i }).click();
      await page.getByText("README.md").waitFor({ state: "visible" });

      await page.getByRole("button", { name: /^\+ add$/i }).click();
      await page.getByLabel("Block title").fill("Onboarding Export Block");
      await page.getByPlaceholder(/write markdown instructions/i).fill("Export from onboarding flow");
      await page.getByLabel("GitHub Copilot").click();

      const targetCheckbox = page.getByRole("checkbox", { name: "AGENTS.md" });
      await targetCheckbox.check();

      await page.getByRole("button", { name: /^compile$/i }).click();
      await page.getByText("Manifest").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "readme-md.instructions.md" }).waitFor({ state: "visible" });
      await page.getByText(/ready to export/i).waitFor({ state: "visible" });

      const exportButton = page.getByRole("button", { name: /^export/i });
      await exportButton.waitFor({ state: "visible" });
      const exportHandle = await exportButton.elementHandle();
      if (exportHandle) {
        await page.waitForFunction((button) => !button.hasAttribute("disabled"), exportHandle);
      }
      await exportButton.click();
      await page.getByText(/export complete/i).waitFor({ state: "visible" });

      if (exportScreenshotPath) {
        await fs.mkdir(path.dirname(exportScreenshotPath), { recursive: true });
        await page.screenshot({ path: exportScreenshotPath, fullPage: true });
      }
    });
  }, 60000);
});
