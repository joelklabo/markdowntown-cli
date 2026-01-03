import path from "node:path";
import fs from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;
const scanScreenshotPath = process.env.E2E_SCREENSHOT_PATH;
const workbenchScreenshotPath = process.env.E2E_WORKBENCH_SCREENSHOT_PATH;
const enableVideo = process.env.E2E_VIDEO_PATH && process.env.E2E_VIDEO_LABEL === "scan-to-export";
const videoHeadless = process.env.E2E_VIDEO_HEADLESS === "1";
const viewport = {
  width: Number.parseInt(process.env.E2E_VIEWPORT_WIDTH ?? "1280", 10),
  height: Number.parseInt(process.env.E2E_VIEWPORT_HEIGHT ?? "900", 10),
};
const recoveryEnabled = process.env.E2E_SCAN_RECOVERY === "1";
const fixturesRoot = path.join(process.cwd(), "__tests__/e2e/fixtures");

async function setWebkitDirectoryFiles(page: Page, fixtureName: string) {
  const root = path.join(fixturesRoot, fixtureName);
  const input = page.locator("input[aria-label=\"Upload folder\"]");
  await input.waitFor({ state: "attached", timeout: 60000 });
  await input.setInputFiles(root, { timeout: 120000 });
}

describe("Scan to workbench export flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const enableVideo = process.env.E2E_VIDEO_PATH && process.env.E2E_VIDEO_LABEL === "scan-to-export";
  const maybe = baseURL && !enableVideo ? it : it.skip;

  maybe("scans a folder, refreshes results, and exports in Workbench", { timeout: 70000 }, async () => {
    await withE2EPage(
      browser,
      { baseURL, viewport },
      async (page) => {
        await page.addInitScript(({ recoveryEnabled }) => {
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
          ]);

          let attempts = 0;
          (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker = async () => {
            if (recoveryEnabled && attempts === 0) {
              attempts += 1;
              throw new DOMException("Permission denied", "NotAllowedError");
            }
            return root;
          };
        }, { recoveryEnabled });

        await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: /^scan a folder$/i }).first().waitFor({ state: "visible" });
        await page.waitForTimeout(1000);

        const scanButtons = page.getByRole("button", { name: /scan a folder/i });
        const scanButton = (await scanButtons.count()) > 1 ? scanButtons.nth(1) : scanButtons.first();
        await scanButton.waitFor({ state: "visible", timeout: 60000 });
        await scanButton.scrollIntoViewIfNeeded();
        await scanButton.click();
        if (recoveryEnabled) {
          await page
            .getByText("Permission denied. Check folder access and try again. Files stay local.", { exact: true })
            .waitFor({ state: "visible" });
          await scanButton.click();
        }

        const loadedList = page.getByRole("list", { name: /loaded files/i });
        await loadedList.getByText(".github/copilot-instructions.md", { exact: true }).waitFor({ state: "visible" });
        await page.getByRole("heading", { name: /quick actions/i }).waitFor({ state: "visible" });
        try {
          await page.getByRole("heading", { name: /next steps/i }).waitFor({ state: "visible", timeout: 5000 });
        } catch {
          // Next steps panel may render without a visible heading until results settle.
        }
        try {
          await page.getByRole("button", { name: /open workbench/i }).first().waitFor({ state: "visible", timeout: 5000 });
        } catch {
          await page.getByRole("link", { name: /open workbench/i }).first().waitFor({ state: "visible" });
        }
        const refreshButtons = page.getByRole("button", { name: /refresh results/i });
        if ((await refreshButtons.count()) > 0) {
          await refreshButtons.first().click();
        }

        const openWorkbenchCta = page.getByTestId("next-steps-open-workbench");
        if ((await openWorkbenchCta.count()) > 0) {
          try {
            await openWorkbenchCta.waitFor({ state: "visible", timeout: 5000 });
          } catch {
            const showAll = page.getByRole("button", { name: /show all/i });
            if ((await showAll.count()) > 0) {
              await showAll.first().click();
            }
            await openWorkbenchCta.waitFor({ state: "visible" });
          }
          await openWorkbenchCta.click();
        } else {
          const actionsCta = page.getByRole("link", { name: /open workbench/i });
          await actionsCta.first().waitFor({ state: "visible" });
          await actionsCta.first().click();
        }
        await page.waitForURL(/\/workbench/, { waitUntil: "domcontentloaded", timeout: 60000 });
        if (workbenchScreenshotPath) {
          await fs.mkdir(path.dirname(workbenchScreenshotPath), { recursive: true });
          await page.screenshot({ path: workbenchScreenshotPath, fullPage: true });
        }

        await page.getByTestId("workbench-scan-defaults-status").waitFor({ state: "visible" });
        await page.getByText(/GitHub Copilot · cwd \(repo root\)/i).first().waitFor({ state: "visible" });

        await page.getByTestId("workbench-scopes-panel").waitFor({ state: "visible" });

        await page.getByRole("button", { name: /add scope/i }).click();
        await page.getByLabel("Scope glob pattern").fill("src/**/*.ts");
        await page.getByRole("button", { name: /^add$/i }).click();

        await page.getByText("src/**/*.ts").waitFor({ state: "visible" });

        const addBlockButton = page.getByRole("button", { name: /^\+ add$/i });
        await addBlockButton.scrollIntoViewIfNeeded();
        await addBlockButton.click();
        const blockTitle = page.getByLabel("Block title");
        await blockTitle.waitFor({ state: "visible", timeout: 30000 });
        await blockTitle.scrollIntoViewIfNeeded();
        await blockTitle.fill("Scan Export Block");
        const instructionsInput = page.getByPlaceholder(/write markdown instructions/i);
        await instructionsInput.waitFor({ state: "visible", timeout: 30000 });
        await instructionsInput.scrollIntoViewIfNeeded();
        await instructionsInput.fill("Export from scan flow");
        const copilotTarget = page.getByRole("checkbox", { name: /github copilot/i });
        await copilotTarget.waitFor({ state: "visible" });
        expect(await copilotTarget.isChecked()).toBe(true);

        await page.getByRole("button", { name: /^compile$/i }).click();
        await page.getByText("Manifest").waitFor({ state: "visible" });
        await page.getByRole("button", { name: "src-ts.instructions.md" }).waitFor({ state: "visible" });

        await page.getByText(/ready to export/i).waitFor({ state: "visible" });
        const exportButton = page.getByRole("button", { name: /^export/i });
        expect(await exportButton.isEnabled()).toBe(true);
        await exportButton.click();
        await page.getByText(/export complete/i).waitFor({ state: "visible" });

        if (scanScreenshotPath && !workbenchScreenshotPath) {
          await fs.mkdir(path.dirname(scanScreenshotPath), { recursive: true });
          await page.screenshot({ path: scanScreenshotPath, fullPage: true });
        }
      },
      "scan-to-export"
    );
  });

  maybe("keeps scan results consistent after refresh", { timeout: 60000 }, async () => {
    await withE2EPage(
      browser,
      { baseURL, viewport },
      async (page) => {
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

          const githubDir = makeDir(".github", [["copilot-instructions.md", makeFile("copilot-instructions.md")]]);
          const root = makeDir("mock-repo", [[".github", githubDir]]);

          (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker = async () => root;
        });

        await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: /scan a folder/i }).first().click();

        const extraList = page.getByRole("list", { name: /loaded files/i });
        await extraList.getByText(".github/copilot-instructions.md", { exact: true }).waitFor({ state: "visible" });

        const refreshButtons = page.getByRole("button", { name: /refresh results/i });
        if ((await refreshButtons.count()) > 0) {
          await refreshButtons.first().click();
        }

        const text = (await extraList.allTextContents()).join("\n");
        expect(text).toContain("copilot-instructions.md");
      },
      "scan-refresh"
    );
  });
});

const video = baseURL && enableVideo ? it : it.skip;

video("records scan → workbench export for video capture", { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: videoHeadless });
  const context = await browser.newContext({
    baseURL,
    viewport,
    recordVideo: { dir: path.dirname(process.env.E2E_VIDEO_PATH!) },
  });
  await context.addInitScript(({ recoveryEnabled }) => {
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

    let attempts = 0;
    (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker = async () => {
      if (recoveryEnabled && attempts === 0) {
        attempts += 1;
        throw new DOMException("Permission denied", "NotAllowedError");
      }
      return root;
    };
  }, { recoveryEnabled });
  const page = await context.newPage();
  await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /^scan a folder$/i }).first().waitFor({ state: "visible" });
  await page.waitForTimeout(1000);

  const scanButtons = page.getByRole("button", { name: /scan a folder/i });
  if ((await scanButtons.count()) > 0) {
    const scanButton = (await scanButtons.count()) > 1 ? scanButtons.nth(1) : scanButtons.first();
    await scanButton.waitFor({ state: "attached", timeout: 60000 });
    await scanButton.scrollIntoViewIfNeeded();
    await scanButton.click({ timeout: 60000, force: true });
    if (recoveryEnabled) {
      await page
        .getByText("Permission denied. Check folder access and try again. Files stay local.", { exact: true })
        .waitFor({ state: "visible" });
      await scanButton.click({ timeout: 60000, force: true });
    }
  } else {
    await page.getByLabel("Upload folder").waitFor({ state: "visible" });
    await setWebkitDirectoryFiles(page, "scan-sample");
    const runScanButton = page.getByRole("button", { name: /^scan a folder$/i }).first();
    await runScanButton.waitFor({ state: "visible", timeout: 60000 });
    await runScanButton.click();
  }

  const loadedList = page.getByRole("list", { name: /loaded files/i });
  await loadedList.getByText(".github/copilot-instructions.md", { exact: true }).waitFor({ state: "visible" });
  const refreshButtons = page.getByRole("button", { name: /refresh results/i });
  if ((await refreshButtons.count()) > 0) {
    await refreshButtons.first().click();
  }

  const openWorkbenchCta = page.getByTestId("next-steps-open-workbench");
  if ((await openWorkbenchCta.count()) > 0) {
    try {
      await openWorkbenchCta.waitFor({ state: "visible", timeout: 5000 });
    } catch {
      const showAll = page.getByRole("button", { name: /show all/i });
      if ((await showAll.count()) > 0) {
        await showAll.first().click();
      }
      await openWorkbenchCta.waitFor({ state: "visible" });
    }
    await openWorkbenchCta.click();
  } else {
    const actionsCta = page.getByRole("link", { name: /open workbench/i });
    await actionsCta.first().waitFor({ state: "visible" });
    await actionsCta.first().click();
  }
  await page.waitForURL(/\/workbench/);

  await page.getByText(/scan defaults applied/i).waitFor({ state: "visible" });
  await page.getByText(/GitHub Copilot · cwd \(repo root\)/i).waitFor({ state: "visible" });

  await page.getByTestId("workbench-scopes-panel").waitFor({ state: "visible" });

  await page.getByRole("button", { name: /add scope/i }).click();
  await page.getByLabel("Scope glob pattern").fill("src/**/*.ts");
  await page.getByRole("button", { name: /^add$/i }).click();

  await page.getByText("src/**/*.ts").waitFor({ state: "visible" });

  const exportButton = page.getByRole("button", { name: /^export$/i });
  await exportButton.scrollIntoViewIfNeeded();
  await exportButton.waitFor({ state: "visible", timeout: 30000 });
  await exportButton.click();
  await page.getByText("Manifest").waitFor({ state: "visible" });

  if (workbenchScreenshotPath) {
    await fs.mkdir(path.dirname(workbenchScreenshotPath), { recursive: true });
    await page.screenshot({ path: workbenchScreenshotPath, fullPage: true });
  }

  const video = page.video();
  await context.close();
  await browser.close();

  if (video && process.env.E2E_VIDEO_PATH) {
    const source = await video.path();
    await fs.rm(process.env.E2E_VIDEO_PATH, { force: true }).catch(() => {});
    await fs.rename(source, process.env.E2E_VIDEO_PATH);
  }
});
