import path from "node:path";
import fs from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

const fixturesRoot = path.join(process.cwd(), "__tests__/e2e/fixtures");

async function listFixturePaths(fixtureName: string): Promise<string[]> {
  const root = path.join(fixturesRoot, fixtureName);
  const paths: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile()) {
        paths.push(path.relative(root, fullPath));
      }
    }
  }

  await walk(root);
  return paths.sort();
}

async function mockDirectoryPicker(page: Page, fixtureName: string) {
  const paths = await listFixturePaths(fixtureName);
  await page.addInitScript(
    ({ paths, rootName }) => {
      const buildTree = (pathsInput: string[]) => {
        const root: Record<string, Record<string, unknown> | null> = {};
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
            node = node[part] as Record<string, Record<string, unknown> | null>;
          });
        }
        return root;
      };

      const makeHandle = (name: string, node: Record<string, Record<string, unknown> | null> | null) => {
        if (node === null) {
          return { kind: "file", name };
        }
        const entries = Object.entries(node).map(([childName, childNode]) => [childName, makeHandle(childName, childNode as Record<string, Record<string, unknown> | null> | null)]);
        return {
          kind: "directory",
          name,
          entries: async function* entriesGenerator() {
            for (const entry of entries) {
              yield entry as [string, { kind: string; name: string }];
            }
          },
        };
      };

      const tree = buildTree(paths);
      const handle = makeHandle(rootName, tree);
      (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker = async () => handle;
    },
    { paths, rootName: fixtureName }
  );
}

async function mockDirectoryPickerWithFailure(page: Page, fixtureName: string) {
  const paths = await listFixturePaths(fixtureName);
  await page.addInitScript(
    ({ paths, rootName }) => {
      const buildTree = (pathsInput: string[]) => {
        const root: Record<string, Record<string, unknown> | null> = {};
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
            node = node[part] as Record<string, Record<string, unknown> | null>;
          });
        }
        return root;
      };

      const makeHandle = (name: string, node: Record<string, Record<string, unknown> | null> | null) => {
        if (node === null) {
          return { kind: "file", name };
        }
        const entries = Object.entries(node).map(([childName, childNode]) => [childName, makeHandle(childName, childNode as Record<string, Record<string, unknown> | null> | null)]);
        return {
          kind: "directory",
          name,
          entries: async function* entriesGenerator() {
            for (const entry of entries) {
              yield entry as [string, { kind: string; name: string }];
            }
          },
        };
      };

      const tree = buildTree(paths);
      const handle = makeHandle(rootName, tree);
      let calls = 0;
      (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker = async () => {
        calls += 1;
        if (calls === 1) {
          throw new DOMException("Permission denied", "NotAllowedError");
        }
        return handle;
      };
    },
    { paths, rootName: fixtureName }
  );
}

async function setWebkitDirectoryFiles(page: Page, fixtureName: string) {
  const root = path.join(fixturesRoot, fixtureName);
  await page.locator("input[aria-label=\"Upload folder\"]").setInputFiles(root);
}

describe("Atlas scan guidance flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("shows scan setup guidance", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });

      await page.getByRole("heading", { name: /scan setup/i }).waitFor({ state: "visible" });

      const clarityCopy = page.getByText(/scan a folder to see which instruction files load/i);
      if ((await clarityCopy.count()) > 0) {
        await clarityCopy.first().waitFor({ state: "visible" });
      }

      const localOnly = page.getByText(/local-only scan/i);
      if ((await localOnly.count()) > 0) {
        await localOnly.first().waitFor({ state: "visible" });
      }

      const quickStart = page.getByText(/quick start/i);
      if ((await quickStart.count()) > 0) {
        await quickStart.first().waitFor({ state: "visible" });
      }
    });
  });

  maybe("covers empty scan results and missing instructions", { timeout: 60000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await mockDirectoryPicker(page, "scan-empty");

      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /scan a folder/i }).first().click();

      await page.getByText(/no files would be loaded for this input/i).waitFor({ state: "visible" });
      await page.getByRole("list", { name: /missing instruction files/i }).waitFor({ state: "visible" });

      expect(await page.getByTestId("next-steps-open-workbench").count()).toBe(0);
    }, "scan-empty");
  });

  maybe("shows results CTA for sample scan", { timeout: 60000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await mockDirectoryPicker(page, "scan-sample");

      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /scan a folder/i }).first().click();

      const loadedList = page.getByRole("list", { name: /loaded files/i });
      await loadedList.getByText(".github/copilot-instructions.md", { exact: true }).waitFor({ state: "visible" });

      const agentsInLoaded = loadedList.getByText("AGENTS.md", { exact: true });
      const shadowedList = page.getByRole("list", { name: /shadowed instruction files/i });
      const agentsInShadowed = shadowedList.getByText("AGENTS.md", { exact: true });
      await Promise.race([
        agentsInLoaded.waitFor({ state: "visible", timeout: 15000 }),
        agentsInShadowed.waitFor({ state: "visible", timeout: 15000 }),
      ]);

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
      } else {
        const actionsCta = page.getByRole("link", { name: /open workbench/i });
        await actionsCta.first().waitFor({ state: "visible" });
      }
    }, "scan-sample");
  });

  maybe("surfaces permission errors", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.addInitScript(() => {
        (window as unknown as { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker = async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        };
      });

      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /scan a folder/i }).first().click();

      await page
        .getByText("Permission denied. Check folder access and try again. Files stay local.", { exact: true })
        .waitFor({ state: "visible" });
    }, "scan-permission-denied");
  });

  maybe("recovers from permission errors on retry", { timeout: 60000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await mockDirectoryPickerWithFailure(page, "scan-sample");

      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /scan a folder/i }).first().click();
      await page
        .getByText("Permission denied. Check folder access and try again. Files stay local.", { exact: true })
        .waitFor({ state: "visible" });

      await page.getByRole("button", { name: /scan a folder/i }).first().click();
      await page.getByText(/2 instruction files found.*2 total files scanned/i).waitFor({ state: "visible" });
    }, "scan-permission-recover");
  });

  maybe("supports webkitdirectory fallback uploads", { timeout: 60000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.addInitScript(() => {
        // @ts-expect-error removing for fallback test
        delete window.showDirectoryPicker;
      });

      await page.goto("/atlas/simulator", { waitUntil: "domcontentloaded" });
      await page.getByLabel("Upload folder").waitFor({ state: "visible" });

      await setWebkitDirectoryFiles(page, "scan-sample");

      const loadedList = page.getByRole("list", { name: /loaded files/i });
      await loadedList.getByText(".github/copilot-instructions.md", { exact: true }).waitFor({ state: "visible" });
    }, "scan-webkitdirectory-fallback");
  });
});
