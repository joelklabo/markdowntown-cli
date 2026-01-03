import { chromium, Browser } from "playwright";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const headless = true;

describe("Publish artifact flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const hasAuthEnv = Boolean(process.env.E2E_TEST_USER && process.env.E2E_STORAGE_STATE);
  const run = hasAuthEnv ? it : it.skip;
  const testName = "publishes an artifact, verifies visibility, and finds it in Library";
  const skippedName = `${testName} (set E2E_TEST_USER and E2E_STORAGE_STATE; see docs/qa/e2e-test-user.md)`;

  run(hasAuthEnv ? testName : skippedName, async () => {
    const title = `E2E Publish ${Date.now()}`;

    await withE2EPage(
      browser,
      { baseURL, storageState: process.env.E2E_STORAGE_STATE ?? undefined },
      async (page) => {
        await page.goto("/workbench", { waitUntil: "domcontentloaded" });
        await page.getByLabel(/agent title/i).fill(title);
        await page.getByLabel(/visibility/i).selectOption("PRIVATE");

        const firstSave = page.waitForResponse(
          (res) => res.url().includes("/api/artifacts/save") && res.request().method() === "POST" && res.ok()
        );
        await page.getByRole("button", { name: /^save$/i }).click();
        const firstSaveRes = await firstSave;
        const firstSaveJson = (await firstSaveRes.json()) as { id?: string };
        const artifactId = firstSaveJson.id;
        expect(artifactId).toBeTruthy();

        await page.getByText(/cloud: saved/i).waitFor({ state: "visible" });

        const staleContextPage = await page.context().newPage();
        await staleContextPage.goto(`/workbench?id=${artifactId}`, { waitUntil: "domcontentloaded" });
        await staleContextPage.getByText(/library item loaded/i).waitFor({ state: "visible" });
        await staleContextPage.getByLabel(/agent title/i).fill(`${title} v2`);
        const secondSave = staleContextPage.waitForResponse(
          (res) => res.url().includes("/api/artifacts/save") && res.request().method() === "POST" && res.ok()
        );
        await staleContextPage.getByRole("button", { name: /^save$/i }).click();
        await secondSave;
        await staleContextPage.getByText(/cloud: saved/i).waitFor({ state: "visible" });
        await staleContextPage.close();

        await page.getByLabel(/agent title/i).fill(`${title} local`);
        const conflictSave = page.waitForResponse(
          (res) => res.url().includes("/api/artifacts/save") && res.request().method() === "POST" && res.status() === 409
        );
        await page.getByRole("button", { name: /^save$/i }).click();
        await conflictSave;
        await page.getByText(/save conflict detected/i).waitFor({ state: "visible" });
        await page.getByRole("button", { name: /reload latest/i }).click();

        // Unauthenticated reads should be forbidden while PRIVATE.
        const privateRes = await fetch(`${baseURL}/api/artifacts/${artifactId}`);
        expect(privateRes.status).toBe(403);

        const blockBody = page.getByPlaceholder(/write markdown instructions/i);
        if ((await blockBody.count()) === 0) {
          await page.getByRole("button", { name: /^\+ add$/i }).click();
          await page.getByLabel("Block title").fill("Publish Secret Scan Block");
        }
        await page
          .getByPlaceholder(/write markdown instructions/i)
          .fill("Contains secret ghp_0123456789abcdef0123456789abcdef0123");

        // Publish as PUBLIC (creates a new version).
        await page.getByLabel(/visibility/i).selectOption("PUBLIC");
        await page.getByRole("button", { name: /^save$/i }).click();
        await page.getByText(/secret scan warning/i).waitFor({ state: "visible" });
        await page.getByRole("button", { name: /review/i }).click();
        await page.getByText(/review potential secrets/i).waitFor({ state: "visible" });
        await page.getByRole("checkbox", { name: /i understand/i }).check();
        const publishSave = page.waitForResponse(
          (res) => res.url().includes("/api/artifacts/save") && res.request().method() === "POST" && res.ok()
        );
        await page.getByRole("button", { name: /acknowledge/i }).click();
        await publishSave;
        await page.getByText(/cloud: saved/i).waitFor({ state: "visible" });

        const publicRes = await fetch(`${baseURL}/api/artifacts/${artifactId}`);
        expect(publicRes.status).toBe(200);

        const versionsRes = await fetch(`${baseURL}/api/artifacts/${artifactId}/versions`);
        expect(versionsRes.status).toBe(200);
        const versionsJson = (await versionsRes.json()) as { versions?: unknown[] };
        expect(Array.isArray(versionsJson.versions)).toBe(true);
        expect(versionsJson.versions?.length ?? 0).toBeGreaterThanOrEqual(2);
      },
      "publish"
    );

    await withE2EPage(
      browser,
      { baseURL },
      async (page) => {
        await page.goto(`/library?q=${encodeURIComponent(title)}`, { waitUntil: "domcontentloaded" });
        await page.getByText(title).first().waitFor({ state: "visible" });
      },
      "public-search"
    );
  }, 90000);
});
