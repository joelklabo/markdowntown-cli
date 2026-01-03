import { chromium, type Browser, type Page } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
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
  throw new Error("Server warm-up failed before Atlas examples test.");
}

describe("Atlas platform examples zip", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("requests the examples zip via the API", { timeout: 45000 }, async () => {
    await withE2EPage(
      browser,
      { baseURL, viewport: { width: 1280, height: 900 }, acceptDownloads: true },
      async (page) => {
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(60000);
        await warmupServer(page, baseURL!);
        await page.goto("/atlas/platforms/codex-cli", { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.getByRole("heading", { name: /^codex cli$/i }).first().waitFor({ state: "visible" });

        const downloadButton = page.locator("main header").getByRole("button", { name: /download example zip/i });
        await downloadButton.waitFor({ state: "visible", timeout: 30000 });

        const [response] = await Promise.all([
          page.waitForResponse((resp) => resp.url().includes("/api/atlas/examples/zip") && resp.request().method() === "POST"),
          downloadButton.click(),
        ]);
        expect(response.status()).toBe(200);
      },
      "atlas-platform-examples"
    );
  });
});
