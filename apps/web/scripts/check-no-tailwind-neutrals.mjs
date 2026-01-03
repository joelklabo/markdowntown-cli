#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { globby } from "globby";

const patterns = ["src/components/ui/**/*.{ts,tsx}"];

const ignore = [
  "**/node_modules/**",
  "**/.next/**",
  "**/coverage/**",
  "**/dist/**",
  "**/public/**",
  "**/__snapshots__/**",
];

const neutralClassPattern = /\b(?:text|bg|border)-(?:gray|slate|zinc|neutral)-\d{1,3}(?:\/\d+)?\b/g;

async function run() {
  const files = await globby(patterns, { ignore });
  const offenders = [];

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((line, idx) => {
      const matches = line.match(neutralClassPattern);
      if (!matches?.length) return;
      offenders.push({
        file,
        line: idx + 1,
        matches: Array.from(new Set(matches)),
        snippet: line.trim(),
      });
    });
  }

  if (offenders.length) {
    console.error("Found raw Tailwind neutral palette classes in ui primitives (use MDT tokens instead):");
    for (const o of offenders) {
      console.error(`- ${path.normalize(o.file)}:${o.line}  ${o.matches.join(", ")}  ${o.snippet}`);
    }
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

