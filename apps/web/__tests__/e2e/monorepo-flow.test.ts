import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";
import path from "node:path";
import fs from "node:fs";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Monorepo CLI -> Web Flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
    // Ensure screenshot dir exists
    const screenshotDir = path.resolve(__dirname, "../../../../docs/screenshots/e2e");
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("navigates projects -> snapshot -> workspace", { timeout: 60000 }, async () => {
    await withE2EPage(browser, { baseURL }, async (page) => {
        const screenshotDir = path.resolve(__dirname, "../../../../docs/screenshots/e2e");

        // 1. Projects List
        await page.goto("/projects");
        await page.getByRole("heading", { name: "Projects" }).waitFor({ state: "visible" });
        
        await page.screenshot({ path: path.join(screenshotDir, "monorepo-flow-projects.png") });

        // 2. Click first project
        const projectLink = page.locator('a[href^="/projects/"]').first();
        if (await projectLink.isVisible()) {
            await projectLink.click();
            await page.getByRole("heading", { name: "Snapshots" }).waitFor({ state: "visible" });
            await page.screenshot({ path: path.join(screenshotDir, "monorepo-flow-snapshots.png") });

            // 3. Click first snapshot
            const snapshotLink = page.locator('a[href*="/snapshots/"]').first();
            if (await snapshotLink.isVisible()) {
                await snapshotLink.click();
                await page.screenshot({ path: path.join(screenshotDir, "monorepo-flow-snapshot-detail.png") });

                // 4. Open Workspace
                const workspaceLink = page.getByRole("link", { name: "Open Workspace" });
                if (await workspaceLink.isVisible()) {
                    await workspaceLink.click();
                    await page.getByRole("heading", { name: "Editor Workspace" }).waitFor({ state: "visible" });
                    await page.screenshot({ path: path.join(screenshotDir, "monorepo-flow-workspace.png") });
                }
            }
        }
    });
  });
});