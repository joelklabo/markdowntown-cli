#!/usr/bin/env node

import { execSync } from "node:child_process";
import { computeEpicStatusUpdates } from "./bd-epic-readiness.mjs";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token) continue;

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
      continue;
    }

    args._.push(token);
  }
  return args;
}

function usage(exitCode = 0) {
  const msg = [
    "Block open epics that still have open child issues, so `bd ready` stays focused on actionable tasks.",
    "",
    "Usage:",
    "  node scripts/bd-sync-epic-readiness.mjs",
    "  node scripts/bd-sync-epic-readiness.mjs --dry-run",
    "",
    "Notes:",
    "- This script does NOT unblock epics automatically.",
    "- Child links are inferred from `parent-child` dependency edges in the Beads JSONL export.",
  ].join("\n");
  console.log(msg);
  process.exit(exitCode);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) usage(0);

function execBd(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function exportIssuesJsonl() {
  try {
    return execBd("bd export");
  } catch (err) {
    const stderr = String(err?.stderr ?? err?.output?.[2] ?? err?.message ?? "");
    if (stderr.includes("Database out of sync with JSONL")) {
      console.log("bd database out of sync; running `bd sync --import-only`…");
      execSync("bd sync --import-only", { stdio: "inherit" });
      return execBd("bd export");
    }
    throw err;
  }
}

const raw = exportIssuesJsonl();
const lines = raw.split("\n").filter(Boolean);
const issues = lines.map((line) => JSON.parse(line));

const updates = computeEpicStatusUpdates(issues);

if (updates.length === 0) {
  console.log("No epic readiness updates needed.");
  process.exit(0);
}

if (args.dryRun) {
  console.log(`Would block ${updates.length} epic(s):`);
  for (const update of updates) {
    console.log(`- ${update.id} (${update.from} → ${update.to}) children: ${update.openChildren.join(", ")}`);
  }
  process.exit(0);
}

for (const update of updates) {
  console.log(`Blocking ${update.id} (open children: ${update.openChildren.join(", ")})…`);
  execSync(`bd update ${update.id} --status ${update.to}`, { stdio: "inherit" });
}

