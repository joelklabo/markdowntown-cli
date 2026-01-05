import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { chromium, Browser } from "playwright";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { withE2EPage } from "./playwrightArtifacts";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const headless = process.env.HEADLESS !== "false";
const screenshotPath = process.env.E2E_SCREENSHOT_PATH;

// Resolve Repo Root Robustly
const repoRoot = process.env.REPO_ROOT || 
  execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();

// Resolve CLI Binary (Strict Contract)
const cliBin = process.env.E2E_CLI_BIN || 
  path.join(repoRoot, "cli/bin/markdowntown");

describe("Monorepo E2E Flow", () => {
  let browser: Browser;
  let tempRepo: string;

  beforeAll(async () => {
    // 1. Validate Binary Existence (Fail Fast)
    if (!fs.existsSync(cliBin)) {
      throw new Error(
        `CLI binary not found at: ${cliBin}\n` +
        `Please run 'make build' in the cli/ directory or set E2E_CLI_BIN.`
      );
    }

    browser = await chromium.launch({ headless });
    
    // 2. Prepare temp repo
    tempRepo = path.join(repoRoot, "tmp", `e2e-repo-${Date.now()}`);
    fs.mkdirSync(tempRepo, { recursive: true });
    fs.writeFileSync(path.join(tempRepo, "README.md"), "# E2E Test Repo\n\nThis is a test.");
    fs.writeFileSync(path.join(tempRepo, "main.go"), "package main\n\nfunc main() {}");
  });

  afterAll(async () => {
    await browser?.close().catch(() => {});
    // Robust cleanup
    if (tempRepo && fs.existsSync(tempRepo)) {
      try {
        fs.rmSync(tempRepo, { recursive: true, force: true });
      } catch (e) {
        console.warn("Failed to cleanup temp repo:", e);
      }
    }
  });

  const maybe = baseURL ? it : it.skip;

  maybe("full flow: login -> token -> cli upload -> snapshot -> workspace", { timeout: 120000 }, async () => {
    await withE2EPage(browser, { baseURL, viewport: { width: 1280, height: 900 } }, async (page) => {
      // 1. Login to Web & Generate Token
      await page.goto("/signin");
      await page.fill('input[type="password"]', "demo-login");
      await page.click('button:has-text("Demo login")');
      await expect(page).toHaveURL("/");

      await page.goto("/tokens");
      await page.click('button:has-text("Create Token")');
      const tokenInput = page.locator('input[readonly]');
      await tokenInput.waitFor({ state: "visible" });
      const token = await tokenInput.inputValue();
      expect(token.length).toBeGreaterThan(10);

      // 2. Configure CLI Environment
      const configDir = path.join(tempRepo, ".config");
      fs.mkdirSync(configDir, { recursive: true });
      // Pass PATH to ensure git/other tools are found if needed
      const env = { 
        ...process.env, 
        XDG_CONFIG_HOME: configDir,
        PATH: process.env.PATH 
      };

      console.log("Logging in via CLI...");
      // USE execFileSync to avoid shell injection with the token
      execFileSync(cliBin, ["login", "--token", token, "--base-url", baseURL], { 
        env, 
        encoding: "utf-8",
        timeout: 10000 
      });

      // 3. Upload Snapshot
      console.log("Uploading snapshot...");
      const output = execFileSync(cliBin, [
        "upload", 
        "--repo", tempRepo, 
        "--project", "e2e-flow", 
        "--quiet"
      ], { 
        env, 
        encoding: "utf-8",
        timeout: 30000 
      });
      
      // 4. Extract URL (Robust Regex)
      // Matches "View: http..." allowing for surrounding whitespace
      const match = output.match(/View:\s+(https?:\/\/[^\s]+)/);
      if (!match) {
        throw new Error(`Could not find upload URL in CLI output:\n${output}`);
      }
      const snapshotUrl = match[1];

      // 5. Navigate to Snapshot
      await page.goto(snapshotUrl);
      await expect(page.getByRole("heading", { name: /Snapshot/i })).toBeVisible();
      await expect(page.getByText("README.md")).toBeVisible();
      
      if (screenshotPath) {
        const snapShotPath = path.join(path.dirname(screenshotPath), "monorepo-flow-snapshot.png");
        await page.screenshot({ path: snapShotPath });
      }

      // 6. Open Workspace
      const workspaceLink = page.getByRole("link", { name: "Open Workspace" });
      await workspaceLink.waitFor({ state: "visible" });
      await workspaceLink.click();
      await expect(page.getByRole("heading", { name: "Editor Workspace" })).toBeVisible();
      await expect(page.getByText("README.md")).toBeVisible();

      if (screenshotPath) {
        const workspaceShotPath = path.join(path.dirname(screenshotPath), "monorepo-flow-workspace.png");
        await page.screenshot({ path: workspaceShotPath });
      }

    }, "monorepo-flow");
  });
});