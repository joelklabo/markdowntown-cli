#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
const passthrough = [];
let filter = null;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--") {
    continue;
  }
  if (arg === "--filter") {
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      console.error("Missing value for --filter");
      process.exit(1);
    }
    filter = next;
    i += 1;
    continue;
  }
  passthrough.push(arg);
}

const vitestArgs = ["run", "--config", "vitest.e2e.config.ts", ...passthrough];
if (filter) {
  vitestArgs.push("-t", filter);
}

const result = spawnSync("vitest", vitestArgs, { stdio: "inherit" });
process.exit(typeof result.status === "number" ? result.status : 1);
