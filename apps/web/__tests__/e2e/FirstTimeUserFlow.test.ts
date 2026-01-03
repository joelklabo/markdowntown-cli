import fs from "node:fs/promises";
import { chromium, Browser } from "playwright";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const storageState = process.env.E2E_STORAGE_STATE;
const headless = true;

describe("First-time user journey", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL && storageState ? it : it.skip;

  maybe(
    "creates section, builds document, inserts snippet, copies and downloads markdown",
    { timeout: 90000 },
    async () => {
      const runId = Date.now().toString();
      await withE2EPage(
        browser,
        { baseURL, storageState, acceptDownloads: true },
        async (page, context) => {
          if (baseURL) {
            await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
          }

          // Create a private section (our snippet)
          await page.goto("/", { waitUntil: "domcontentloaded" });
          await page.getByRole("button", { name: /add a new section/i }).click();
          await page.getByPlaceholder("Section title").fill(`E2E Section ${runId}`);
          const snippetBody = `Snippet body ${runId} **bold**`;
          await page.getByPlaceholder("Write markdown here...").fill(snippetBody);
          await page.getByLabel(/Tags \(comma separated\)/i).fill("e2e, snippet");
          // blur to trigger save
          await page.getByText("Preview", { exact: true }).click();
          await page.waitForResponse(
            (response) => response.url().includes("/api/sections") && response.request().method() === "PUT"
          );

          // Create agents.md document
          await page.goto("/documents/new", { waitUntil: "domcontentloaded" });
          await page.getByLabel(/title/i).fill(`E2E agents ${runId}`);
          await page.getByLabel(/agents\.md content/i).fill(`# My agents ${runId}\n\nInitial body text`);
          await page.getByRole("button", { name: /create document/i }).click();
          const contentArea = page.getByLabel(/agents\.md content/i);
          await contentArea.waitFor({ state: "visible" });

          // Edit + insert snippet content
          await contentArea.fill(`# My agents ${runId}\n\nBody updated`);
          const select = page.getByLabel(/choose snippet/i);
          await select.waitFor({ state: "visible" });
          await select.selectOption({ label: `E2E Section ${runId}` });
          await page.getByRole("button", { name: /insert into document/i }).click();

          const current = await contentArea.inputValue();
          expect(current).toContain(`E2E Section ${runId}`);
          expect(current).toContain(snippetBody);

          await page.getByRole("button", { name: /save changes/i }).click();

          // Copy markdown and read clipboard
          await page.getByRole("button", { name: /copy markdown/i }).click();
          const clipboard = await page.evaluate(() => navigator.clipboard.readText());
          expect(clipboard).toContain(`E2E Section ${runId}`);
          expect(clipboard).toContain(`Snippet body ${runId}`);

          // Download markdown and compare content
          const [download] = await Promise.all([
            page.waitForEvent("download"),
            page.getByRole("button", { name: /download/i }).click(),
          ]);
          const downloadPath = await download.path();
          expect(downloadPath).toBeTruthy();
          const fileContent = await fs.readFile(downloadPath!, "utf8");
          expect(fileContent).toContain(`E2E Section ${runId}`);
          expect(fileContent).toContain(`Snippet body ${runId}`);
          expect(fileContent.trim()).toBe(clipboard.trim());
        }
      );
    }
  );
});
