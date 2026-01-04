import path from "node:path";
import fs from "node:fs/promises";
import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("CLI sync workbench handoff", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("cli-sync-workbench renders CTA and captures screenshot", { timeout: 45000 }, async () => {
    await withE2EPage(
      browser,
      { baseURL, viewport: { width: 1400, height: 900 } },
      async (page) => {
        await page.goto(
          "/workbench?cliRepoId=markdowntown-cli&cliSnapshotId=4c9b2a1&cliBranch=main&cliStatus=ready",
          { waitUntil: "domcontentloaded" }
        );
        await page.getByText("CLI snapshot", { exact: true }).first().waitFor({ state: "visible" });
        await page.getByRole("button", { name: /export patch/i }).waitFor({ state: "visible" });
        await page.getByRole("button", { name: /copy cli command/i }).waitFor({ state: "visible" });

        const screenshotPath = path.join(
          process.cwd(),
          "..",
          "..",
          "docs",
          "screenshots",
          "cli-sync",
          "workbench-handoff.png"
        );
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.waitForTimeout(500);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      },
      "cli-sync-workbench"
    );
  });

  maybe("cli-sync-workbench shows invalid snapshot banner", { timeout: 45000 }, async () => {
    await withE2EPage(
      browser,
      { baseURL, viewport: { width: 1400, height: 900 } },
      async (page) => {
        await page.goto("/workbench?cliRepoId=demo-repo&cliStatus=invalid", { waitUntil: "domcontentloaded" });
        await page.getByText("CLI snapshot unavailable").waitFor({ state: "visible" });
        await page.getByText("Status must be ready or pending.").waitFor({ state: "visible" });

        const dismissButton = page.getByRole("button", { name: "Dismiss", exact: true });
        await dismissButton.waitFor({ state: "visible" });
        await dismissButton.click();
        await page.getByText("CLI snapshot unavailable").waitFor({ state: "hidden" });

        const screenshotPath = path.join(
          process.cwd(),
          "..",
          "..",
          "docs",
          "screenshots",
          "cli-sync",
          "workbench-handoff-invalid.png"
        );
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.waitForTimeout(500);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      },
      "cli-sync-workbench-invalid"
    );
  });
});
