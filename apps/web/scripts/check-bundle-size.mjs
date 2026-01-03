#!/usr/bin/env node
/**
 * Simple bundle size budget check.
 * Measures total bytes of compiled client chunks in .next/static/chunks.
 */
import fs from "fs";
import path from "path";

const chunksDir = path.join(process.cwd(), ".next", "static", "chunks");
const budget = Number(process.env.BUNDLE_BUDGET_BYTES || 1_400_000); // ~1.4 MB default
const ignoredPrefixes = ["framework-", "main-", "polyfills-", "webpack-"];
const reactLoadablePath = path.join(process.cwd(), ".next", "react-loadable-manifest.json");
const buildManifestPath = path.join(process.cwd(), ".next", "build-manifest.json");

const optionalModules = [
  { pattern: "posthog", enabled: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) },
  { pattern: "web-vitals", enabled: process.env.NEXT_PUBLIC_ENABLE_RUM === "true" },
];

const optionalFiles = new Set();
if (fs.existsSync(reactLoadablePath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(reactLoadablePath, "utf8"));
    for (const [label, entry] of Object.entries(manifest)) {
      for (const opt of optionalModules) {
        if (opt.enabled) continue;
        if (label.includes(opt.pattern)) {
          entry.files?.forEach((f) => optionalFiles.add(path.join("static", "chunks", path.basename(f))));
        }
      }
    }
  } catch (err) {
    console.warn("Unable to parse react-loadable-manifest.json for optional chunk filtering", err);
  }
}

const rootMainFiles = new Set();
if (fs.existsSync(buildManifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf8"));
    for (const file of manifest.rootMainFiles || []) {
      rootMainFiles.add(path.basename(file));
    }
  } catch (err) {
    console.warn("Unable to parse build-manifest.json for root main files", err);
  }
}

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

const files = collectFiles(chunksDir);
if (files.length === 0) {
  console.error("No bundle files found in .next/static/chunks. Run `pnpm build` first.");
  process.exit(1);
}

let total = 0;
let largest = { file: "", size: 0 };
for (const file of files) {
  const name = path.basename(file);
  if (ignoredPrefixes.some((prefix) => name.startsWith(prefix))) {
    continue;
  }
  if (rootMainFiles.has(name)) {
    continue;
  }
  const rel = path.join("static", "chunks", name);
  if (optionalFiles.has(rel)) {
    continue;
  }
  const size = fs.statSync(file).size;
  total += size;
  if (size > largest.size) largest = { file, size };
}

const formatKb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`Bundle size: total=${formatKb(total)}; files=${files.length}; largest=${formatKb(largest.size)} (${path.basename(largest.file)})`);

if (total > budget) {
  console.error(`❌ Bundle budget exceeded: ${formatKb(total)} > ${formatKb(budget)} (set BUNDLE_BUDGET_BYTES to override)`);
  process.exit(1);
}

console.log("✅ Bundle size within budget.");
