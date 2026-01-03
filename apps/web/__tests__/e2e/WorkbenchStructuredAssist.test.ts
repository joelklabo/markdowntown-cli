import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { test, expect } from "@playwright/test";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const screenshotPath = process.env.E2E_WORKBENCH_STRUCTURED_ASSIST_SCREENSHOT_PATH;

test.describe("Workbench structured assist", () => {
  test.describe.configure({ mode: "serial" });
  let browser: Browser;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? test : test.skip;

  maybe("inserts a structured block", async () => {
    test.setTimeout(45000);
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/workbench", { waitUntil: "domcontentloaded" });

      const assistButton = page.getByRole("button", { name: /structured assist/i });
      await assistButton.first().waitFor({ state: "visible" });
      await assistButton.first().click();

      const panel = page.getByTestId("structured-assist-panel");
      await panel.waitFor({ state: "visible" });

      if (screenshotPath) {
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await panel.screenshot({ path: screenshotPath });
      }

      await panel.getByLabel("Scope").selectOption("dir");
      await panel.getByLabel("Directory path").fill("src/app");
      await panel.getByLabel("Block kind").selectOption("commands");
      await panel.getByLabel("Block title (optional)").fill("CLI commands");

      await page.getByRole("button", { name: /insert block/i }).click();

      await expect(panel).toBeHidden();

      const scopesPanel = page.getByTestId("workbench-scopes-panel");
      await scopesPanel.getByText("src/app", { exact: true }).waitFor({ state: "visible" });
      await page.getByText("CLI commands", { exact: true }).waitFor({ state: "visible" });
    }, "workbench-structured-assist");
  });
});
