import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
// Plan-specified default path, overridable by env
const screenshotPath =
  process.env.E2E_SCREENSHOT_PATH || "docs/screenshots/core-flows/library-workbench-export.png";

describe("Library to export", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("opens workbench and exports from library", { timeout: 90000 }, async () => {
    await withE2EPage(
      browser,
      {
        baseURL,
        viewport: { width: 1280, height: 900 },
        acceptDownloads: true,
      },
      async (page) => {
        // 1. Open /library
        await page.goto("/library", { waitUntil: "domcontentloaded" });
        
        const rows = page.getByTestId("artifact-row");
        const emptyState = page
          .getByRole("heading", { name: /no public items match those filters|no public items/i })
          .first();

        await Promise.race([
          rows.first().waitFor({ state: "visible", timeout: 15000 }),
          emptyState.waitFor({ state: "visible", timeout: 15000 }),
        ]);

        const rowCount = await rows.count();
        if (rowCount === 0) {
          await emptyState.waitFor({ state: "visible" });
          return;
        }

        // 2. Choose a row (Prefer seeded item known to have AGENTS.md/agents-md target)
        // Seed title: "Official: Repo-aware coding assistant"
        const seedRow = rows.filter({ hasText: "Repo-aware coding assistant" });
        const targetRow = (await seedRow.count()) > 0 ? seedRow.first() : rows.first();
        
        const openLink = targetRow.getByRole("link", { name: /open in workbench/i });
        await openLink.click();

        // 3. Ensure workbench loaded
        await page.waitForURL(/\/workbench/);
        await page.getByTestId("workbench-scopes-panel").waitFor({ state: "visible", timeout: 20000 });
        
        // Wait for compiler to be ready (button visible)
        const compileButton = page.getByRole("button", { name: /^compile$/i }).first();
        await compileButton.waitFor({ state: "visible", timeout: 20000 });

        // Add a block if empty (ensure body content)
        const editorPanel = page.locator("#workbench-editor-panel");
        const blockBody = page.locator("#workbench-block-body");
        
        // If we landed on a fresh workbench or empty state, ensure we have a block
        // (The seed item usually has blocks, but let's be safe)
        if (await blockBody.count() === 0) {
          const addOrOpenButton = editorPanel.getByTestId("workbench-add-block").first();
          if (await addOrOpenButton.isVisible()) {
            await addOrOpenButton.click();
          }
        }
        
        await blockBody.waitFor({ state: "visible", timeout: 20000 });
        // Fill block body to ensure we have content to compile
        await blockBody.fill("# E2E Test Export\n\nVerifying compile and export flow.");

        // 4. Select AGENTS.md target
        // The seed item uses 'agents-md' target. Label might be "AGENTS.md" or "agents-md".
        // We use a regex to be flexible.
        const targetCheckbox = page.getByRole("checkbox", { name: /agents\.md|agents-md/i });
        await targetCheckbox.waitFor({ state: "visible" });
        
        if (!(await targetCheckbox.isChecked())) {
          await targetCheckbox.check();
        }

        // 5. Compile
        const compilePromise = page.waitForResponse((response) => 
          response.url().includes("/api/compile") && response.status() === 200
        );
        await compileButton.click();
        await compilePromise;

        // Wait for Manifest to appear
        await page.getByText("Manifest").waitFor({ state: "visible", timeout: 20000 });

        // 6. Export and Assert Zip
        const exportButton = page.getByRole("button", { name: /export/i }).first();
        await exportButton.waitFor({ state: "visible", timeout: 20000 });
        expect(await exportButton.isEnabled()).toBe(true);

        const [download] = await Promise.all([
          page.waitForEvent("download"),
          exportButton.click(),
        ]);

        expect(download.suggestedFilename()).toBe("outputs.zip");
        
        // Verify ZIP content
        const zipPath = await download.path();
        const zipData = await fs.readFile(zipPath);
        const zip = await JSZip.loadAsync(zipData);
        
        // We expect AGENTS.md because we selected it
        // The key in zip might be "AGENTS.md" or inside a folder depending on implementation
        const files = Object.keys(zip.files);
        const hasAgentsMd = files.some(f => f.endsWith("AGENTS.md"));
        expect(hasAgentsMd, `ZIP should contain AGENTS.md. Found: ${files.join(", ")}`).toBe(true);

        // 7. Capture Screenshot
        if (screenshotPath) {
          await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
          await page.screenshot({ path: screenshotPath, fullPage: true });
        }
      }
    );
  });
});
