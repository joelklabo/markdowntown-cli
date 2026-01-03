import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "__tests__/visual",
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  outputDir: "test-results/playwright-visual",
  reporter: process.env.CI
    ? [
        ["html", { open: "never" }],
        ["list"],
      ]
    : [["list"]],
  expect: {
    toMatchSnapshot: { threshold: 0.2 },
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    headless: true,
    trace: process.env.CI ? "retain-on-failure" : "off",
    screenshot: process.env.CI ? "only-on-failure" : "off",
  },
});
