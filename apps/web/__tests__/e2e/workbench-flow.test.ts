import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Workbench flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("builds a simple export from scratch", { timeout: 60000 }, async () => {
    await withE2EPage(browser, { baseURL }, async (page) => {
      await page.goto("/workbench", { waitUntil: "domcontentloaded" });

      const scopesPanel = page.getByTestId("workbench-scopes-panel");
      const skillsPanel = page.getByTestId("workbench-skills-panel");

      await scopesPanel.waitFor({ state: "visible" });
      await skillsPanel.waitFor({ state: "visible" });
      await skillsPanel.getByText("No skills yet").waitFor({ state: "visible" });

      await page.getByRole("button", { name: /add scope/i }).click();
      await page.getByLabel("Scope glob pattern").fill("README.md");
      await page.getByRole("button", { name: /^add$/i }).click();

      await page.getByText("README.md").waitFor({ state: "visible" });

      await page.getByRole("button", { name: /^\+ add$/i }).click();
      await page.getByLabel("Block title").fill("Workbench Export Block");
      await page.getByPlaceholder(/write markdown instructions/i).fill("Export from workbench flow");
      await page.getByLabel("GitHub Copilot").click();

      await page.getByRole("button", { name: /^compile$/i }).click();
      await page.getByText("Manifest").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "readme-md.instructions.md" }).waitFor({ state: "visible" });
    });
  });
});
