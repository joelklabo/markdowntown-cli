import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/test/playwright',
  timeout: 120000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
  },
  outputDir: 'test-results',
});
