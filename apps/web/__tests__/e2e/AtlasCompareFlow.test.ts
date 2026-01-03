import { chromium, type Browser } from "playwright";
import { describe, it, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Atlas compare drilldown", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("shows claims when selecting a matrix cell and clears drilldown", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      await page.goto("/atlas/compare", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /^compare$/i }).waitFor({ state: "visible" });

      const emptyState = page.getByText(/select a matrix cell to view claims/i).first();
      await emptyState.waitFor({ state: "visible" });

      await page.getByRole("button", { name: /show details for repo-instructions on codex-cli/i }).click();
      await page.getByText(/codex cli loads repository instructions from agents\.md/i).waitFor({ state: "visible" });

      await page.getByRole("button", { name: /^clear$/i }).click();
      await emptyState.waitFor({ state: "visible" });
    }, "atlas-compare");
  });
});
