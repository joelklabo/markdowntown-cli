import fs from "node:fs/promises";
import JSZip from "jszip";
import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL;
const headless = true;

describe("Translate export flow", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const maybe = baseURL ? it : it.skip;

  maybe("compiles markdown and downloads a zip with expected files", async () => {
    await withE2EPage(
      browser,
      { baseURL, acceptDownloads: true },
      async (page) => {
        page.setDefaultTimeout(120000);
        page.setDefaultNavigationTimeout(120000);

        await page.goto("/translate", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);

        const markdown = `# Translate E2E

This is a test export.

- one
- two
`;

        const input = page.getByPlaceholder(/paste markdown or uam v1 json/i);
        await input.waitFor({ state: "visible" });
        await input.click();
        await input.fill(markdown);
        await page.waitForFunction(
          () => {
            const ta = document.querySelector('textarea[placeholder*="Paste Markdown"]') as HTMLTextAreaElement | null;
            return Boolean(ta?.value.includes("Translate E2E"));
          },
          undefined,
          { timeout: 120000 }
        );

        // Toggle targets to ensure selection is covered.
        await page.getByRole("checkbox", { name: /github copilot/i }).click();
        await page.getByRole("checkbox", { name: /github copilot/i }).click();

        const compile = page.getByRole("button", { name: /compile files/i });
        await page.waitForFunction(
          () => {
            const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Compile files") as
              | HTMLButtonElement
              | undefined;
            return Boolean(btn && !btn.disabled);
          },
          undefined,
          { timeout: 120000 }
        );
        await compile.click();

        await page.locator(".font-mono", { hasText: "AGENTS.md" }).waitFor({ state: "visible" });
        await page.locator(".font-mono", { hasText: ".github/copilot-instructions.md" }).waitFor({ state: "visible" });

        const [download] = await Promise.all([
          page.waitForEvent("download"),
          page.getByRole("button", { name: /download zip/i }).click(),
        ]);

        const downloadPath = await download.path();
        expect(downloadPath).toBeTruthy();
        const buffer = await fs.readFile(downloadPath!);

        const zip = await JSZip.loadAsync(buffer);
        const entries = Object.values(zip.files)
          .filter((f) => !f.dir)
          .map((f) => f.name);

        expect(entries).toContain("AGENTS.md");
        expect(entries).toContain(".github/copilot-instructions.md");

        const agentsMd = await zip.file("AGENTS.md")?.async("string");
        expect(agentsMd?.trim().length).toBeGreaterThan(0);
        expect(agentsMd).toContain("Translate E2E");

        const copilotMd = await zip.file(".github/copilot-instructions.md")?.async("string");
        expect(copilotMd?.trim().length).toBeGreaterThan(0);
        expect(copilotMd).toContain("Translate E2E");
      },
      "export-zip"
    );
  }, 120000);
});
