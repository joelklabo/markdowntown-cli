import fs from "node:fs";
import path from "node:path";

import { generateAtlasChangelog } from "./generate-changelog.ts";

const atlasDir = path.join(process.cwd(), "atlas");

if (!fs.existsSync(atlasDir)) {
  console.warn("[atlas:changelog] No atlas/ directory found; skipping.");
  process.exit(0);
}

const result = await generateAtlasChangelog({ atlasDir });

if (result.markdownSummary) {
  console.log(result.markdownSummary.trimEnd());
} else {
  console.log("[atlas:changelog] No claim/support changes detected.");
}
