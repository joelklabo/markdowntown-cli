import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const headless = process.env.E2E_VIDEO_HEADLESS === "1";

const fixturesRoot = path.join(process.cwd(), "__tests__/e2e/fixtures");
const fixtureName = "scan-sample";

async function listFixturePaths(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const childPaths = await listFixturePaths(fullPath);
      for (const child of childPaths) {
        paths.push(path.join(entry.name, child));
      }
      continue;
    }
    if (entry.isFile()) {
      paths.push(entry.name);
    }
  }
  return paths.sort();
}

async function findScanButton(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const locator = page.locator("button", { hasText: "Scan a folder" });
    if ((await locator.count()) > 0) return locator.first();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  return page.getByRole("button", { name: /scan a folder/i }).first();
}

async function runFlow({ videoPath, viewport, recovery }) {
  const fixtureRoot = path.join(fixturesRoot, fixtureName);
  const paths = await listFixturePaths(fixtureRoot);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    baseURL,
    viewport,
    recordVideo: { dir: path.dirname(videoPath) },
  });

  await context.addInitScript(
    ({ paths, recovery }) => {
      const buildTree = (pathsInput) => {
        const root = {};
        for (const rawPath of pathsInput) {
          const parts = rawPath.split("/").filter(Boolean);
          let node = root;
          parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            if (isFile) {
              node[part] = null;
              return;
            }
            if (!node[part] || node[part] === null) {
              node[part] = {};
            }
            node = node[part];
          });
        }
        return root;
      };

      const makeHandle = (name, node) => {
        if (node === null) {
          return { kind: "file", name };
        }
        const entries = Object.entries(node).map(([childName, childNode]) => [childName, makeHandle(childName, childNode)]);
        return {
          kind: "directory",
          name,
          entries: async function* entriesGenerator() {
            for (const entry of entries) {
              yield entry;
            }
          },
        };
      };

      const tree = buildTree(paths);
      const handle = makeHandle("mock-repo", tree);
      let attempts = 0;
      // @ts-expect-error - test-only override
      window.showDirectoryPicker = async () => {
        if (recovery && attempts === 0) {
          attempts += 1;
          throw new DOMException("Permission denied", "NotAllowedError");
        }
        return handle;
      };
    },
    { paths, recovery }
  );

  const page = await context.newPage();
  await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { name: /^scan a folder$/i }).first().waitFor({ state: "visible" });

  const scanButton = await findScanButton(page);
  await scanButton.waitFor({ state: "attached", timeout: 60000 });
  await scanButton.scrollIntoViewIfNeeded();
  await scanButton.click({ timeout: 60000, force: true });
  if (recovery) {
    await page.getByText(/permission denied/i).waitFor({ state: "visible" });
    await scanButton.click({ timeout: 60000, force: true });
  }

  const loadedList = page.getByRole("list", { name: /loaded files/i });
  await loadedList.getByText(".github/copilot-instructions.md", { exact: true }).waitFor({ state: "visible" });

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
  await page.getByTestId("workbench-scopes-panel").waitFor({ state: "visible" });

  const addScopeButton = page.getByRole("button", { name: /add scope/i });
  await addScopeButton.scrollIntoViewIfNeeded();
  await addScopeButton.click();
  await page.getByLabel("Scope glob pattern").fill("src/**/*.ts");
  await page.getByRole("button", { name: /^add$/i }).click();
  await page.getByText("src/**/*.ts").waitFor({ state: "visible" });

  const addBlockButton = page.getByRole("button", { name: /^\+ add$/i });
  await addBlockButton.scrollIntoViewIfNeeded();
  await addBlockButton.click();

  const editorTab = page.getByRole("tab", { name: /editor/i });
  if ((await editorTab.count()) > 0) {
    await editorTab.first().click();
  }

  const blockTitle = page.getByLabel("Block title");
  await blockTitle.waitFor({ state: "visible", timeout: 30000 });
  await blockTitle.scrollIntoViewIfNeeded();
  await blockTitle.fill("Scan Export Block");
  const instructionsInput = page.getByPlaceholder(/write markdown instructions/i);
  await instructionsInput.waitFor({ state: "visible", timeout: 30000 });
  await instructionsInput.scrollIntoViewIfNeeded();
  await instructionsInput.fill("Export from scan flow");

  const outputTab = page.getByRole("tab", { name: /output/i });
  if ((await outputTab.count()) > 0) {
    await outputTab.first().click();
  }

  const targetCheckbox = page.getByRole("checkbox", { name: /github copilot/i });
  if ((await targetCheckbox.count()) > 0 && !(await targetCheckbox.isChecked())) {
    await targetCheckbox.check();
  }

  const compileButton = page.getByRole("button", { name: /^compile$/i });
  await compileButton.scrollIntoViewIfNeeded();
  await compileButton.waitFor({ state: "visible", timeout: 30000 });
  await compileButton.click();
  await page.getByText("Manifest").waitFor({ state: "visible" });

  const exportButton = page.getByRole("button", { name: /export/i });
  await exportButton.scrollIntoViewIfNeeded();
  await exportButton.waitFor({ state: "visible", timeout: 30000 });
  if (await exportButton.isEnabled()) {
    await exportButton.click();
  }

  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const source = await video.path();
    await fs.mkdir(path.dirname(videoPath), { recursive: true });
    await fs.rm(videoPath, { force: true }).catch(() => {});
    await fs.rename(source, videoPath);
  }
}

const flows = [
  {
    name: "flow-1-desktop",
    viewport: { width: 1280, height: 900 },
    recovery: false,
  },
  {
    name: "flow-2-mobile",
    viewport: { width: 390, height: 844 },
    recovery: false,
  },
  {
    name: "flow-3-recovery",
    viewport: { width: 1280, height: 900 },
    recovery: true,
  },
];

for (const flow of flows) {
  const videoPath = path.join("docs", "qa", "videos", "scan-flow", `${flow.name}.mp4`);
  await runFlow({ videoPath, viewport: flow.viewport, recovery: flow.recovery });
}
