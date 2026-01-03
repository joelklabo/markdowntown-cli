import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Library interactions", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("artifact row copy CTA updates state", { timeout: 45000 }, async () => {
    await withE2EPage(
      browser,
      { baseURL, viewport: { width: 1280, height: 900 }, permissions: ["clipboard-write"] },
      async (page, context) => {
        if (baseURL) {
          await context.grantPermissions(["clipboard-write"], { origin: baseURL });
        }

        await page.goto("/library?type=snippet", { waitUntil: "domcontentloaded" });
        expect(page.url()).toMatch(/\/library/);

        const rows = page.getByTestId("artifact-row");
        const emptyState = page.getByRole("heading", { name: /no public items match those filters|no public items/i }).first();

        await Promise.race([
          rows.first().waitFor({ state: "visible", timeout: 15000 }),
          emptyState.waitFor({ state: "visible", timeout: 15000 }),
        ]);

        const rowCount = await rows.count();
        if (rowCount === 0) {
          await emptyState.waitFor({ state: "visible" });
          return;
        }

        const firstRow = rows.first();
        await firstRow.waitFor({ state: "visible" });

        const firstCopy = firstRow.getByRole("button", { name: /copy link/i }).first();
        await firstCopy.waitFor({ state: "visible" });
        await firstCopy.click();
        await page.getByText(/^copied$/i).first().waitFor({ state: "visible" });
      }
    );
  });
});
