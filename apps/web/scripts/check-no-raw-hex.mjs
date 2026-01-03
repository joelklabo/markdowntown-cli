#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { globby } from "globby";

const patterns = [
  "src/**/*.{ts,tsx,js,jsx,css,mdx}",
  "docs/**/*.{md,mdx}",
  "scripts/**/*.{ts,js,mjs,cjs}",
  "tailwind.config.mjs",
  "eslint.config.mjs",
];

const ignore = [
  "**/node_modules/**",
  "**/.next/**",
  "**/coverage/**",
  "**/dist/**",
  "**/public/**",
  "**/*.svg",
  "**/*.ico",
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.webp",
  "**/*.mp4",
  "**/*.map",
  "**/*.json",
];

const hexPattern = /#(?:[0-9a-fA-F]{3,8})(?![a-zA-Z0-9])/g;

async function run() {
  const files = await globby(patterns, { ignore });
  const offenders = [];

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (!hexPattern.test(line)) return;
      // Reset regex state for subsequent tests because of global flag.
      hexPattern.lastIndex = 0;
      offenders.push({
        file,
        line: idx + 1,
        snippet: line.trim(),
      });
    });
  }

  if (offenders.length) {
    console.error("Found raw hex color values (use tokens/vars instead):");
    for (const o of offenders) {
      console.error(`- ${path.normalize(o.file)}:${o.line}  ${o.snippet}`);
    }
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
