import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

test.describe("CLI Sync Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login via demo credentials
    await page.goto("/signin");
    await page.fill('input[type="password"]', "demo-login");
    await page.click('button:has-text("Demo login")');
    await expect(page).toHaveURL("/");
  });

  test("dashboard -> repo detail -> workspace", async ({ page }) => {
    // 1. Dashboard
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    
    // Capture dashboard screenshot
    const dashboardPath = path.join(process.cwd(), "docs/screenshots/cli-sync/dashboard.png");
    fs.mkdirSync(path.dirname(dashboardPath), { recursive: true });
    await page.screenshot({ path: dashboardPath });

    // 2. Project detail (if projects exist)
    // We assume there might be no projects in a fresh test environment.
    // If so, we check empty state.
    const projects = page.locator('div:has-text("No projects found")');
    if (await projects.isVisible()) {
        console.log("No projects found, skipping detail flow");
        return;
    }

    const firstProject = page.locator('a:has-text("View")').first();
    await firstProject.click();
    await expect(page.getByRole("heading", { name: "Snapshots" })).toBeVisible();

    // Capture repo detail screenshot
    const repoDetailPath = path.join(process.cwd(), "docs/screenshots/cli-sync/repo-detail.png");
    await page.screenshot({ path: repoDetailPath });

    // 3. Workspace
    const firstSnapshot = page.locator('a:has-text("View")').first();
    await firstSnapshot.click();
    await expect(page.getByRole("heading", { name: /Snapshot/i })).toBeVisible();

    // Go to workspace
    await page.click('a:has-text("Open Workspace")');
    await expect(page.getByRole("heading", { name: "Editor Workspace" })).toBeVisible();

    // Capture workspace screenshot
    const workspacePath = path.join(process.cwd(), "docs/screenshots/cli-sync/workbench-handoff.png");
    await page.screenshot({ path: workspacePath });
  });
});
