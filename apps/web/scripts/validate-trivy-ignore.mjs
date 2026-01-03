import fs from "node:fs";
import path from "node:path";

const ignorePath = path.resolve(process.cwd(), ".trivyignore");
if (!fs.existsSync(ignorePath)) {
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const lines = fs.readFileSync(ignorePath, "utf8").split(/\r?\n/);

let hasErrors = false;

for (let index = 0; index < lines.length; index += 1) {
  const raw = lines[index];
  if (!raw) continue;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;

  const [idPart, commentPart] = trimmed.split("#", 2).map((part) => part.trim());
  const vulnId = idPart?.trim();
  const comment = commentPart?.trim() ?? "";
  const lineNumber = index + 1;

  if (!vulnId) {
    console.error(`[trivyignore] Line ${lineNumber}: missing vulnerability ID`);
    hasErrors = true;
    continue;
  }

  const untilMatch = comment.match(/\buntil\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (!untilMatch) {
    console.error(
      `[trivyignore] Line ${lineNumber}: "${vulnId}" must include an expiry (e.g. "# until YYYY-MM-DD <reason>")`
    );
    hasErrors = true;
    continue;
  }

  const until = untilMatch[1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    console.error(`[trivyignore] Line ${lineNumber}: "${vulnId}" has invalid until date: ${until}`);
    hasErrors = true;
    continue;
  }

  if (today > until) {
    console.error(
      `[trivyignore] Line ${lineNumber}: "${vulnId}" ignore expired on ${until} (today is ${today})`
    );
    hasErrors = true;
  }
}

if (hasErrors) process.exit(1);

