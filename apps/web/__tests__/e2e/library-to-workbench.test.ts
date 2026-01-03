import { chromium, Browser, type Page } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

async function warmupServer(page: Page, base: string) {
  const healthUrl = new URL("/api/health", base).toString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await page.request.get(healthUrl, { timeout: 15000 });
      if (response.ok()) return;
    } catch {
      // retry after a short delay to avoid cold-start flake
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("Server warm-up failed before Library flow test.");
}

describe("Library to Workbench", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("opens workbench from library", { timeout: 90000 }, async () => {
    await withE2EPage(
      browser,
      {
        baseURL,
        viewport: { width: 1280, height: 900 },
      },
      async (page) => {
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(60000);
        await warmupServer(page, baseURL!);
        await page.goto("/library", { waitUntil: "domcontentloaded", timeout: 60000 });
        const rows = page.getByTestId("artifact-row");
        const emptyState = page
          .getByRole("heading", { name: /no public items match those filters|no public items/i })
          .first();

        await Promise.race([
          rows.first().waitFor({ state: "visible", timeout: 30000 }),
          emptyState.waitFor({ state: "visible", timeout: 30000 }),
        ]);

        const rowCount = await rows.count();
        if (rowCount === 0) {
          await emptyState.waitFor({ state: "visible" });
          return;
        }

        const firstRow = rows.first();
        const previewButton = firstRow.getByRole("button", { name: /preview/i });
        await previewButton.click();
        await page.getByRole("heading", { name: /preview/i }).waitFor({ state: "visible", timeout: 15000 });
        await page.screenshot({
          path: "docs/screenshots/core-flows/library-flow.png",
          fullPage: true,
        });
        await page.keyboard.press("Escape");

        const openLink = firstRow.getByRole("link", { name: /open in workbench/i });
        await openLink.click();

        await page.waitForURL(/\/workbench/);
        await page.getByText(/library item loaded/i).first().waitFor({ state: "visible", timeout: 20000 });
      }
    );
  });
});
