import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Export panel flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("shows skills export options and validates JSON", { timeout: 60000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/workbench", { waitUntil: "domcontentloaded" });
      await page.getByTestId("workbench-scopes-panel").waitFor({ state: "visible" });

      await page.getByRole("button", { name: /\+ skill/i }).click();
      await page.locator("#skill-title").fill("E2E Skill");
      await page.locator("#skill-description").fill("Used to validate skills export options.");

      await page.getByLabel("AGENTS.md").click();

      await page.getByRole("button", { name: /advanced/i }).click();

      const agentsCard = page.getByTestId("export-target-agents-md");
      await agentsCard.waitFor({ state: "visible" });
      await agentsCard.getByText("Skills export").waitFor({ state: "visible" });

      await agentsCard.getByLabel("Allowlist").click();
      await agentsCard.getByText("E2E Skill").waitFor({ state: "visible" });

      const optionsInput = agentsCard.getByLabel("Options for agents-md");
      await optionsInput.fill("{");
      await agentsCard.getByText("Skills export").click();

      await agentsCard.getByText("Invalid JSON options").waitFor({ state: "visible" });
    }, "export-panel");
  });
});
