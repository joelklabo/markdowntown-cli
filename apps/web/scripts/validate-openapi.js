#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "openapi.json");
try {
  const raw = fs.readFileSync(file, "utf8");
  JSON.parse(raw);
  console.log("openapi.json is valid JSON");
} catch (err) {
  console.error("openapi.json validation failed", err);
  process.exit(1);
}
