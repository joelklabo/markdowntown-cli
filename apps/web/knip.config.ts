const config = {
  // Entrypoints include Next app/router files and dev tooling used in CI.
  entry: [
    "next.config.ts",
    "src/app/**/{page,layout,loading,error,not-found,route}.{ts,tsx}",
    "src/app/**/{robots,sitemap}.{ts,tsx}",

    "scripts/**/*.{js,cjs,mjs,ts,cts,mts}",
    ".storybook/**/*.{ts,tsx}",

    "vitest.config.ts",
    "vitest.e2e.config.ts",
    "playwright-visual.config.ts",
    "tailwind.config.mjs",
    "postcss.config.mjs",
    "eslint.config.mjs",
  ],

  project: [
    "src/**/*.{ts,tsx}",
    "scripts/**/*.{js,cjs,mjs,ts,cts,mts}",
    ".storybook/**/*.{ts,tsx}",
    "__tests__/**/*.{ts,tsx}",
  ],

  ignore: [
    "**/*.d.ts",
    "**/.next/**",
    "**/coverage/**",
    "**/dist/**",
    "**/node_modules/**",
  ],

  // Used via child_process spawn in scripts/lint-markdown.js (not detectable via static imports).
  // Also required as top-level deps so Turbopack can externalize Sentry/OTel instrumentation packages.
  ignoreDependencies: ["markdownlint-cli2", "import-in-the-middle", "require-in-the-middle"],

  // Enable ecosystem plugins so knip understands tool entrypoints/config.
  next: true,
  vitest: true,
  "playwright-test": true,
  storybook: true,
  prisma: true,
  eslint: true,
  tailwind: true,
  postcss: true,
};

export default config;
