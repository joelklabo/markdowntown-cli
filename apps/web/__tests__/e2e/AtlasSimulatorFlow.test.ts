import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import { withE2EPage } from "./playwrightArtifacts";
import { SCAN_TREE_VIRTUALIZATION_THRESHOLD } from "../../src/components/atlas/SimulatorScanMeta";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const rulesMetaScreenshotPath = process.env.E2E_SCAN_RULES_META_SCREENSHOT_PATH;
const shadowedScreenshotPath = process.env.E2E_SCAN_SHADOWED_SCREENSHOT_PATH;
const reportInaccuracyScreenshotPath = process.env.E2E_SCAN_REPORT_INACCURACY_SCREENSHOT_PATH;
const virtualizedTreeScreenshotPath = process.env.E2E_SCAN_VIRTUALIZED_TREE_SCREENSHOT_PATH;

async function maybeCaptureRulesMeta(page: Page) {
  if (!rulesMetaScreenshotPath) return;
  const scanMeta = page.getByTestId("scan-meta");
  await scanMeta.getByText(/rules verified/i).waitFor({ state: "visible" });
  fs.mkdirSync(path.dirname(rulesMetaScreenshotPath), { recursive: true });
  await scanMeta.screenshot({ path: rulesMetaScreenshotPath });
}

async function maybeCaptureShadowedPanel(page: Page) {
  if (!shadowedScreenshotPath) return;
  const shadowedHeading = page.getByText(/shadowed or overridden files/i);
  await shadowedHeading.waitFor({ state: "visible" });
  const shadowedPanel = shadowedHeading.locator("..");
  await shadowedPanel.getByText("AGENTS.md", { exact: true }).waitFor({ state: "visible" });
  await shadowedPanel.getByText(/used by/i).waitFor({ state: "visible" });
  fs.mkdirSync(path.dirname(shadowedScreenshotPath), { recursive: true });
  await shadowedPanel.screenshot({ path: shadowedScreenshotPath });
}

async function maybeCaptureReportInaccuracy(page: Page) {
  if (!reportInaccuracyScreenshotPath) return;
  const summaryHeading = page.getByRole("heading", { name: "Summary" });
  await summaryHeading.waitFor({ state: "visible" });
  const summaryCard = summaryHeading.locator("..");
  await summaryCard.getByRole("link", { name: "Report inaccuracy" }).waitFor({ state: "visible" });
  fs.mkdirSync(path.dirname(reportInaccuracyScreenshotPath), { recursive: true });
  await summaryCard.screenshot({ path: reportInaccuracyScreenshotPath });
}

async function buildZipFixture(): Promise<string> {
  const zip = new JSZip();
  zip.file("AGENTS.md", "# Agents");
  zip.file(".github/copilot-instructions.md", "# Copilot");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipPath = path.join(process.cwd(), "tmp", `atlas-zip-upload-${Date.now()}.zip`);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  fs.writeFileSync(zipPath, buffer);
  return zipPath;
}

test.describe("Atlas simulator flow", () => {
  test.describe.configure({ mode: "serial" });
  let browser: Browser;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? test : test.skip;

  maybe("switches tools and updates loaded files", async () => {
    test.setTimeout(45000);
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.addInitScript(() => {
        const makeFile = (name: string) => ({ kind: "file", name });
        const makeDir = (name: string, entries: Array<[string, { kind: string; name: string }]>) => ({
          kind: "directory",
          name,
          entries: async function* entriesGenerator() {
            for (const [entryName, handle] of entries) {
              yield [entryName, handle] as [string, { kind: string; name: string }];
            }
          },
        });

        const root = makeDir("mock-repo", [
          [
            ".github",
            makeDir(".github", [["copilot-instructions.md", makeFile("copilot-instructions.md")]]),
          ],
          ["AGENTS.md", makeFile("AGENTS.md")],
        ]);

        (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker = async () => root;
      });

      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /^scan a folder$/i }).first().waitFor({ state: "visible" });

      const loadedList = page.getByRole("list", { name: /loaded files/i });
      await page.getByRole("button", { name: /scan a folder/i }).first().click();
      await loadedList.getByText(".github/copilot-instructions.md", { exact: true }).waitFor({ state: "visible" });
      const copilotText = (await loadedList.allTextContents()).join("\n");
      expect(copilotText.trim().length).toBeGreaterThan(0);
      await maybeCaptureRulesMeta(page);
      await maybeCaptureShadowedPanel(page);
      await maybeCaptureReportInaccuracy(page);

      // Switch to Codex CLI and refresh results.
      await page.getByText(/show advanced settings/i).click();
      await page.getByLabel("Tool", { exact: true }).selectOption("codex-cli");
      const refreshButtons = page.getByRole("button", { name: /refresh results/i });
      if ((await refreshButtons.count()) > 0) {
        await refreshButtons.first().click();
      }
      await loadedList.getByText("AGENTS.md", { exact: true }).waitFor({ state: "visible" });

      const codexText = (await loadedList.allTextContents()).join("\n");
      expect(codexText.trim().length).toBeGreaterThan(0);
      expect(codexText).not.toEqual(copilotText);
    }, "atlas-simulator");
  });

  maybe("scans a folder and updates insights when switching tools", async () => {
    test.setTimeout(45000);
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.addInitScript(() => {
        const makeFile = (name: string) => ({ kind: "file", name });
        const makeDir = (name: string, entries: Array<[string, { kind: string; name: string }]>) => ({
          kind: "directory",
          name,
          entries: async function* entriesGenerator() {
            for (const [entryName, handle] of entries) {
              yield [entryName, handle] as [string, { kind: string; name: string }];
            }
          },
        });

        const root = makeDir("mock-repo", [
          [
            ".github",
            makeDir(".github", [["copilot-instructions.md", makeFile("copilot-instructions.md")]]),
          ],
          ["AGENTS.md", makeFile("AGENTS.md")],
        ]);

        (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker = async () => root;
      });

      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /^scan a folder$/i }).first().waitFor({ state: "visible" });

      await page.getByRole("button", { name: /scan a folder/i }).first().click();

      const loadedList = page.getByRole("list", { name: /loaded files/i });
      await loadedList.getByText(".github/copilot-instructions.md", { exact: true }).waitFor({ state: "visible" });

      const missingList = page.getByRole("list", { name: /missing instruction files/i });
      await missingList.getByText("Scoped instructions", { exact: true }).waitFor({ state: "visible" });

      await page.getByText(/show advanced settings/i).click();
      await page.getByLabel("Tool", { exact: true }).selectOption("codex-cli");
      const refreshButtons = page.getByRole("button", { name: /refresh results/i });
      if ((await refreshButtons.count()) > 0) {
        await refreshButtons.first().click();
      }

      await loadedList.getByText("AGENTS.md", { exact: true }).waitFor({ state: "visible" });
      await missingList.getByText("Directory override (root)", { exact: true }).waitFor({ state: "visible" });
    }, "atlas-simulator-folder-scan");
  });

  maybe("uploads a ZIP and scans its contents", async () => {
    test.setTimeout(90000);
    const zipPath = await buildZipFixture();
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /^scan a folder$/i }).first().waitFor({ state: "visible" });
      await page
        .waitForFunction(
          () => (window as unknown as { __atlasZipScan?: unknown }).__atlasZipScan !== undefined,
          undefined,
          { timeout: 5000 },
        )
        .catch(() => {});

      await page.getByLabel(/upload zip/i).setInputFiles(zipPath);
      const loadedList = page.getByRole("list", { name: /loaded files/i });
      await loadedList
        .getByText(".github/copilot-instructions.md", { exact: true })
        .waitFor({ state: "visible", timeout: 60000 });

      await page.getByText(/show advanced settings/i).click();
      await page.getByLabel("Tool", { exact: true }).selectOption("codex-cli");
      const refreshButtons = page.getByRole("button", { name: /refresh results/i });
      if ((await refreshButtons.count()) > 0) {
        await refreshButtons.first().click();
      }

      await loadedList.getByText("AGENTS.md", { exact: true }).waitFor({ state: "visible" });
    }, "atlas-simulator-zip-scan");
  });

  maybe("virtualizes large path lists in the scan preview", async () => {
    test.setTimeout(45000);
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /^scan a folder$/i }).first().waitFor({ state: "visible" });

      const pastePathsButton = page.getByRole("button", { name: /paste paths/i });
      if ((await pastePathsButton.count()) > 0) {
        await pastePathsButton.first().click();
      } else {
        const advancedSummary = page.locator("summary", { hasText: /show advanced settings/i });
        if ((await advancedSummary.count()) > 0) {
          await advancedSummary.first().click();
        }
      }
      const manualPaths = page.getByPlaceholder(/one path per line/i).first();
      const largeList = Array.from(
        { length: SCAN_TREE_VIRTUALIZATION_THRESHOLD + 25 },
        (_, index) => `docs/file-${index}.md`,
      ).join("\n");
      await manualPaths.fill(largeList);

      const previewTree = page.getByTestId("virtualized-file-tree");
      await previewTree.waitFor({ state: "visible" });

      if (virtualizedTreeScreenshotPath) {
        fs.mkdirSync(path.dirname(virtualizedTreeScreenshotPath), { recursive: true });
        await previewTree.screenshot({ path: virtualizedTreeScreenshotPath });
      }
    }, "atlas-simulator-virtualized-tree");
  });
});
