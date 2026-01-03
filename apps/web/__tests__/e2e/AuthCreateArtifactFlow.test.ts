import { chromium, Browser } from "playwright";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const headless = true;

describe("Authenticated artifact flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const hasAuthEnv = Boolean(process.env.E2E_TEST_USER && process.env.E2E_STORAGE_STATE);
  const skipReason =
    "requires E2E_TEST_USER and E2E_STORAGE_STATE (see docs/qa/e2e-test-user.md)";
  const maybe = hasAuthEnv ? it : it.skip;
  const testName = hasAuthEnv
    ? "signs in (storage) and saves an artifact from Workbench"
    : `signs in (storage) and saves an artifact from Workbench (skipped: ${skipReason})`;

  maybe(testName, async () => {
    await withE2EPage(
      browser,
      { baseURL, storageState: process.env.E2E_STORAGE_STATE ?? undefined },
      async (page) => {
        await page.goto("/workbench", { waitUntil: "domcontentloaded" });

        await page.getByLabel(/agent title/i).fill("E2E Artifact");
        await page.getByRole("button", { name: /^save$/i }).click();

        await expect(page.getByText(/cloud: saved/i)).toBeVisible();
      }
    );
  }, 60000);
});
