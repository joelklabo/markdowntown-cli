import { chromium, type Browser, type Page } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

async function assertNoNextRuntimeOverlay(page: Page) {
  const runtimeDialogCount = await page.getByRole("dialog", { name: /runtime/i }).count();
  expect(runtimeDialogCount).toBe(0);

  const errorHeadingCount = await page.getByRole("heading", { name: /something went wrong/i }).count();
  expect(errorHeadingCount).toBe(0);

  const tryAgainCount = await page.getByRole("button", { name: /try again/i }).count();
  expect(tryAgainCount).toBe(0);
}

describe("Atlas smoke", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("loads core Atlas routes without runtime errors", { timeout: 45000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      const routes: Array<{ href: string; heading: RegExp }> = [
        { href: "/atlas", heading: /^atlas$/i },
        { href: "/atlas/platforms/codex-cli", heading: /^codex cli$/i },
        { href: "/atlas/compare", heading: /^compare$/i },
        { href: "/atlas/simulator", heading: /^scan a folder$/i },
        { href: "/atlas/changelog", heading: /^changelog$/i },
        { href: "/atlas/concepts/scoping", heading: /^scoping$/i },
        { href: "/atlas/recipes/safe-shell-commands", heading: /^safe shell commands$/i },
      ];

      for (const route of routes) {
        await page.goto(route.href, { waitUntil: "domcontentloaded" });
        await assertNoNextRuntimeOverlay(page);
        await page.getByRole("heading", { name: route.heading }).first().waitFor({ state: "visible" });
      }
    }, "atlas-smoke");
  });
});
