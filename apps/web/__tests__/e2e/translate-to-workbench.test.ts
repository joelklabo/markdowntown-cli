import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Translate to Workbench CTA", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("shows Open Workbench after compile", async () => {
    await withE2EPage(
      browser,
      { baseURL },
      async (page) => {
        page.setDefaultTimeout(120000);
        page.setDefaultNavigationTimeout(120000);

        await page.goto("/translate", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);

        const input = page.getByPlaceholder(/paste markdown or uam v1 json/i);
        await input.waitFor({ state: "visible" });
        await input.click();
        await page.keyboard.type("# Translate to Workbench\n\nReady to export.");

        const compile = page.getByTestId("translate-compile");
        await page.waitForFunction(
          () => {
            const btn = document.querySelector('[data-testid=\"translate-compile\"]') as HTMLButtonElement | null;
            return Boolean(btn && !btn.disabled);
          },
          undefined,
          { timeout: 120000 }
        );
        await compile.click();

        const openWorkbench = page.getByRole("link", { name: /open in workbench/i });
        await openWorkbench.waitFor({ state: "visible" });
        expect(await openWorkbench.getAttribute("href")).toBe("/workbench");
      },
      "translate-to-workbench"
    );
  }, 120000);
});
