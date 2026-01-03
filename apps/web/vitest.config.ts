import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    exclude: ["__tests__/visual/**", "__tests__/e2e/**", "**/node_modules/**", "**/.pnpm/**"],
    // @ts-expect-error upstream typing lag; supported in Vitest runtime
    environmentMatchGlobs: [
      ["**/__tests__/api/**", "node"],
      ["**/__tests__/e2e/**", "node"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      thresholds: {
        // Temporary floor aligned to current coverage; raise once component/API suites are added.
        lines: 45,
        statements: 45,
        branches: 40,
        functions: 42,
      },
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/next.config.*",
        "**/postcss.config.*",
        "**/tailwind.config.*",
        "**/eslint.config.*",
        "**/src/app/**",
        "**/src/providers/**",
        // App-shell and rendering wrappers are covered by Playwright; skip from unit coverage.
        "src/components/BuilderClient.tsx",
        "src/components/SiteNav.tsx",
        "src/components/Footer.tsx",
        "src/components/PerfVitals*.tsx",
        "src/components/browse/**",
        "src/components/snippet/SnippetActions.tsx",
        "src/components/template/TemplateActions.tsx",
        "src/**/*config.ts",
        "src/lib/agents/sample.ts",
        "src/lib/analytics.ts",
        "src/lib/sampleContent.ts",
        "src/lib/observability.ts",
        "src/types/**",
        ".next/**",
        "coverage/**",
      ],
    },
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
