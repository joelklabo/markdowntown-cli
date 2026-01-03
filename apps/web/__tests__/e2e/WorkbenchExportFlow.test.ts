import path from "node:path";
import fs from "node:fs/promises";
import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const workbenchScreenshotPath = process.env.E2E_WORKBENCH_SCREENSHOT_PATH;
const exportDiffScreenshotPath = process.env.E2E_EXPORT_SCREENSHOT_PATH;

describe("Workbench export flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("export produces expected filenames", async () => {
    await withE2EPage(browser, { baseURL }, async (page) => {
      await page.goto("/workbench", { waitUntil: "domcontentloaded" });

      await page.getByTestId("workbench-scopes-panel").waitFor({ state: "visible" });
      const skillsPanel = page.getByTestId("workbench-skills-panel");
      await skillsPanel.waitFor({ state: "visible" });

      const addSkill = skillsPanel.getByRole("button", { name: /\\+ skill/i });
      if ((await addSkill.count()) > 0) {
        await addSkill.click();
      } else {
        await skillsPanel.getByRole("button", { name: /add a skill/i }).click();
      }
      await page.locator("#skill-title").fill("Export skill");
      await page.locator("#skill-description").fill("Skill used in export tests.");

      await page.getByRole("button", { name: /^\+ add$/i }).click();

      await page.getByLabel("Block title").fill("My Block");
      await page.getByPlaceholder(/write markdown instructions/i).fill("Hello from root");

      await page.getByLabel("GitHub Copilot").click();
      await page.getByLabel("Claude Code").click();
      await page.getByLabel("AGENTS.md").click();

      const compatibility = page.getByTestId("compatibility-matrix");
      await compatibility.waitFor({ state: "visible" });
      await compatibility.getByText("Skills export").waitFor({ state: "visible" });

      if (workbenchScreenshotPath) {
        await fs.mkdir(path.dirname(workbenchScreenshotPath), { recursive: true });
        await page.screenshot({ path: workbenchScreenshotPath, fullPage: true });
      }

      await page.getByRole("button", { name: /advanced/i }).click();

      const agentsCard = page.getByTestId("export-target-agents-md");
      await agentsCard.waitFor({ state: "visible" });
      await agentsCard.getByText("Skills export").waitFor({ state: "visible" });
      await agentsCard.getByLabel("All skills").click();

      const copilotCard = page.getByTestId("export-target-github-copilot");
      await copilotCard.waitFor({ state: "visible" });
      await copilotCard.getByLabel("All skills").click();

      const claudeCard = page.getByTestId("export-target-claude-code");
      await claudeCard.waitFor({ state: "visible" });
      await claudeCard.getByLabel("All skills").click();
      await page.getByRole("button", { name: /^compile$/i }).click();

      await page.getByText("Manifest").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "AGENTS.md" }).waitFor({ state: "visible" });
      await page.getByRole("button", { name: "copilot-instructions.md" }).waitFor({ state: "visible" });

      await page.getByText(/\.claude\/skills\/.*SKILL\.md/).waitFor({ state: "visible" });

      const exportPanel = page.locator("#workbench-export-panel");
      const diffToggle = exportPanel.getByRole("button", { name: "Diff" });
      await diffToggle.click();
      await exportPanel.getByTestId("diff-viewer").first().waitFor({ state: "visible" });

      if (exportDiffScreenshotPath) {
        await fs.mkdir(path.dirname(exportDiffScreenshotPath), { recursive: true });
        await page.screenshot({ path: exportDiffScreenshotPath, fullPage: true });
      }
    });
  }, 60000);
});
