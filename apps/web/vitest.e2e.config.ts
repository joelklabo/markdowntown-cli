import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: "node",
    include: ["__tests__/e2e/**/*.test.ts"],
    exclude: [
      "__tests__/e2e/AtlasSimulatorFlow.test.ts",
      "__tests__/e2e/WorkbenchDraftRestore.test.ts",
      "__tests__/e2e/WorkbenchStructuredAssist.test.ts",
      "__tests__/visual/**",
      "**/node_modules/**",
      "**/.pnpm/**",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    // Run a single spec via: npm run test:e2e -- <SpecName>
  },
});
