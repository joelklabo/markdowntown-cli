import fs from "node:fs";
import path from "node:path";
import { generateAtlasSearchIndex } from "./generate-index.ts";

const atlasDir = path.join(process.cwd(), "atlas");

if (!fs.existsSync(atlasDir)) {
  console.warn("[atlas:index] No atlas/ directory found; skipping.");
  process.exit(0);
}

const result = generateAtlasSearchIndex({ atlasDir });
const relOutFile = path.relative(process.cwd(), result.outFile);
console.log(`[atlas:index] Wrote ${result.index.items.length} items to ${relOutFile}`);
