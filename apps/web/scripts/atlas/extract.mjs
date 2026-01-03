import fs from "node:fs";
import path from "node:path";

const atlasDir = path.join(process.cwd(), "atlas");

if (!fs.existsSync(atlasDir)) {
  console.warn("[atlas:extract] No atlas/ directory found; skipping.");
  process.exit(0);
}

console.log("[atlas:extract] OK (placeholder)");

