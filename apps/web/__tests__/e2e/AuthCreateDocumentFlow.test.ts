import { chromium, Browser } from "playwright";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const headless = true;

describe("Authenticated snippet + document flow", () => {
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
    ? "signs in (storage), creates snippet, creates document, inserts snippet text, copies preview"
    : `signs in (storage), creates snippet, creates document, inserts snippet text, copies preview (skipped: ${skipReason})`;

  maybe(testName, async () => {
    await withE2EPage(
      browser,
      { baseURL, storageState: process.env.E2E_STORAGE_STATE ?? undefined },
      async (page) => {
        // Create a snippet
        await page.goto("/snippets/new", { waitUntil: "domcontentloaded" });
        await page.getByLabel(/title/i).fill("E2E Snippet");
        await page.getByLabel(/content|body/i).fill("E2E snippet body **bold**");
        await page.getByLabel(/tags/i).fill("e2e, test");
        await page.getByRole("button", { name: /create/i }).click();
        await expect(page.getByText("E2E Snippet")).toBeVisible();

        const snippetText =
          (await page.getByText("E2E snippet body").first().textContent()) ?? "E2E snippet body **bold**";

        // Create a document
        await page.goto("/documents/new", { waitUntil: "domcontentloaded" });
        await page.getByLabel(/Title/i).fill("E2E agents.md");
        await page.getByLabel(/agents\.md content/i).fill("# My agents\n\nInitial body");
        await page.getByLabel(/Tags/i).fill("agents, e2e");
        await page.getByRole("button", { name: /create document/i }).click();
        await expect(page.getByText("Edit agents.md")).toBeVisible();

        const contentArea = page.getByLabel(/agents\.md content/i);
        await contentArea.click();
        await contentArea.press("End");
        await contentArea.type(`\n\n${snippetText}`);
        await page.getByRole("button", { name: /save changes/i }).click();

        await page.goto("/builder", { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: /copy/i }).first().click();
        const preview = await page.locator("main").textContent();
        expect(preview).toContain("E2E snippet body");
      }
    );
  }, 60000);
});
