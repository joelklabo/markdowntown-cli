import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("CTA interactions", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("landing cards and library CTAs respond", async () => {
    await withE2EPage(
      browser,
      { baseURL, permissions: ["clipboard-write"] },
      async (page, context) => {
        if (baseURL) {
          await context.grantPermissions(["clipboard-write"], { origin: baseURL });
        }

        // Landing: browse CTA
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.locator("header").getByRole("link", { name: /^library$/i }).first().click();
        await page.waitForURL(/\/library/);
        await page.getByRole("heading", { name: /library/i }).waitFor({ state: "visible" });

        // Header CTA should route to the scan-first flow.
        const scanCta = page.locator("header").getByRole("link", { name: /scan a folder/i }).first();
        await scanCta.waitFor({ state: "visible" });
        const scanHref = await scanCta.getAttribute("href");
        expect(scanHref).toBe("/atlas/simulator");

        // Library CTAs: copy link + open workbench (if any rows exist).
        const rows = page.getByTestId("artifact-row");
        const rowCount = await rows.count();
        if (rowCount === 0) {
          await page.getByText(/no public items found|no public items/i).first().waitFor({ state: "visible" });
          return;
        }

        const firstRow = rows.first();
        const copy = firstRow.getByRole("button", { name: /copy link/i }).first();
        await copy.waitFor({ state: "visible" });
        await copy.click();
        await page.getByText(/^copied$/i).first().waitFor({ state: "visible" });

        const openWorkbench = firstRow
          .getByRole("link", { name: /open (in )?workbench/i })
          .first();
        await openWorkbench.waitFor({ state: "visible" });
        await openWorkbench.click();
        await page.waitForURL(/\/workbench/);
      }
    );
  }, 45000);
});
