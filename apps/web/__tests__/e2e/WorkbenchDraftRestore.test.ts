import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { test, expect } from "@playwright/test";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const screenshotPath = process.env.E2E_WORKBENCH_DRAFT_RESTORE_SCREENSHOT_PATH;

const storedDraftPayload = JSON.stringify({
  state: {
    uam: {
      schemaVersion: 1,
      meta: { title: "Restored Draft", description: "" },
      scopes: [{ id: "global", kind: "global", name: "Global" }],
      blocks: [{ id: "block-1", scopeId: "global", kind: "markdown", body: "Draft content" }],
      capabilities: [],
      targets: [],
    },
    selectedScopeId: "global",
    visibility: "PRIVATE",
    tags: [],
    lastSavedAt: Date.now(),
  },
  version: 3,
});

test.describe("Workbench draft restore", () => {
  test.describe.configure({ mode: "serial" });
  let browser: Browser;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? test : test.skip;

  maybe("prompts to restore a local draft", async () => {
    test.setTimeout(45000);
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.addInitScript((payload) => {
        window.localStorage.setItem("workbench-storage", payload);
      }, storedDraftPayload);

      await page.goto("/workbench", { waitUntil: "domcontentloaded" });

      const prompt = page.getByTestId("workbench-draft-restore");
      await prompt.waitFor({ state: "visible" });
      await prompt.getByRole("button", { name: /restore draft/i }).waitFor({ state: "visible" });

      if (screenshotPath) {
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        await prompt.screenshot({ path: screenshotPath });
      }

      await prompt.getByRole("button", { name: /restore draft/i }).click();
      await expect(prompt).toBeHidden();
    }, "workbench-draft-restore");
  });
});
