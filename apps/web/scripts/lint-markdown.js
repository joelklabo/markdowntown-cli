#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Run markdownlint-cli2 via child_process; keep CommonJS.
const { spawnSync } = require("node:child_process");
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("No markdown files specified; skipping markdownlint.");
  process.exit(0);
}
const result = spawnSync("markdownlint-cli2", args, { stdio: "inherit" });
process.exit(result.status || 0);
