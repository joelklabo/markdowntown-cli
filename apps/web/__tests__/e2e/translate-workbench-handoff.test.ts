import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const screenshotPath =
  process.env.E2E_SCREENSHOT_PATH || "docs/screenshots/core-flows/translate-workbench-handoff.png";

describe("Translate → Workbench handoff", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("pastes compiled output into Workbench and exports", { timeout: 120000 }, async () => {
    await withE2EPage(
      browser,
      { baseURL, acceptDownloads: true, viewport: { width: 1280, height: 900 } },
      async (page) => {
        page.setDefaultTimeout(120000);
        page.setDefaultNavigationTimeout(120000);

        await page.goto("/translate", { waitUntil: "domcontentloaded" });

        const marker = "Translate handoff E2E";
        const input = page.getByPlaceholder(/paste markdown or uam v1 json/i);
        await input.waitFor({ state: "visible" });
        await input.click();
        await input.fill(`# ${marker}\n\nMove this into Workbench and export.`);

        const compile = page.getByTestId("translate-compile");
        await page.waitForFunction(
          () => {
            const btn = document.querySelector('[data-testid="translate-compile"]') as HTMLButtonElement | null;
            return Boolean(btn && !btn.disabled);
          },
          undefined,
          { timeout: 120000 }
        );

        await Promise.all([
          page.waitForResponse((response) => response.url().includes("/api/compile") && response.status() === 200),
          compile.click(),
        ]);

        await page.getByTestId("translate-ready-actions").waitFor({ state: "visible", timeout: 30000 });

        const resultOutput = page.locator("pre").first();
        await resultOutput.waitFor({ state: "visible", timeout: 30000 });
        const compiledText = (await resultOutput.textContent())?.trim() || `# ${marker}`;
        expect(compiledText).toContain(marker);

        const openWorkbench = page.getByRole("link", { name: /open in workbench/i });
        await openWorkbench.waitFor({ state: "visible", timeout: 20000 });

        const popupPromise = page.waitForEvent("popup").catch(() => null);
        await openWorkbench.click();
        const workbenchPage = (await popupPromise) ?? page;

        if (workbenchPage !== page) {
          await workbenchPage.waitForLoadState("domcontentloaded");
        } else {
          await workbenchPage.waitForURL(/\/workbench/, { waitUntil: "domcontentloaded", timeout: 60000 });
        }

        await workbenchPage.getByTestId("workbench-scopes-panel").waitFor({ state: "visible", timeout: 20000 });

        const editorPanel = workbenchPage.locator("#workbench-editor-panel");
        const blockBody = workbenchPage.locator("#workbench-block-body");

        if (await blockBody.count() === 0) {
          const addOrOpenButton = editorPanel.getByTestId("workbench-add-block").first();
          if (await addOrOpenButton.isVisible()) {
            await addOrOpenButton.click();
          }
        }

        await blockBody.waitFor({ state: "visible", timeout: 20000 });
        await blockBody.fill(compiledText);

        const targetCheckbox = workbenchPage.getByRole("checkbox", { name: /agents\.md|agents-md/i });
        await targetCheckbox.waitFor({ state: "visible", timeout: 20000 });
        if (!(await targetCheckbox.isChecked())) {
          await targetCheckbox.check();
        }

        const compileButton = workbenchPage.getByRole("button", { name: /^compile$/i }).first();
        await compileButton.waitFor({ state: "visible", timeout: 20000 });

        await Promise.all([
          workbenchPage.waitForResponse((response) => response.url().includes("/api/compile") && response.status() === 200),
          compileButton.click(),
        ]);

        await workbenchPage.getByText("Manifest").waitFor({ state: "visible", timeout: 20000 });

        if (screenshotPath) {
          await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
          await workbenchPage.screenshot({ path: screenshotPath, fullPage: true });
        }

        const exportButton = workbenchPage.getByRole("button", { name: /export/i }).first();
        await exportButton.waitFor({ state: "visible", timeout: 20000 });

        const [download] = await Promise.all([
          workbenchPage.waitForEvent("download", { timeout: 30000 }),
          exportButton.click(),
        ]);

        const downloadPath = await download.path();
        expect(downloadPath).toBeTruthy();

        const buffer = await fs.readFile(downloadPath!);
        const zip = await JSZip.loadAsync(buffer);
        const fileEntries = Object.values(zip.files).filter((file) => !file.dir);
        const contents = await Promise.all(
          fileEntries.map(async (file) => ({ name: file.name, content: await file.async("string") }))
        );
        const matched = contents.find(({ content }) => content.includes(marker));
        expect(matched, `Exported zip should contain marker text. Files: ${contents.map((f) => f.name).join(", ")}`).toBeTruthy();
      },
      "translate-workbench-handoff"
    );
  });
});
