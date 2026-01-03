import fs from "node:fs";

const filePath = ".beads/issues.jsonl";
const contents = fs.readFileSync(filePath, "utf8");
const lines = contents.split(/\n/);
let count = 0;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i].trim();
  if (!line) continue;
  count += 1;
  try {
    JSON.parse(line);
  } catch (error) {
    console.error(`Invalid JSONL line ${i + 1} in ${filePath}.`);
    throw error;
  }
}

console.log(`JSONL valid: ${count} lines in ${filePath}.`);
