#!/usr/bin/env node

import { execSync } from "node:child_process";

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
    "Reopen stale bd issues that are stuck in `in_progress`.",
    "",
    "Usage:",
    "  node scripts/bd-reset-stale.mjs --hours 4",
    "  node scripts/bd-reset-stale.mjs --minutes 30",
    "  node scripts/bd-reset-stale.mjs --hours 4 --dry-run",
    "",
    "Options:",
    "  --hours <number>    Threshold in hours (default: 4)",
    "  --minutes <number>  Threshold in minutes (overrides --hours)",
    "  --dry-run           Print what would change without updating",
  ].join("\n");
  console.log(msg);
  process.exit(exitCode);
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) usage(0);

const hours = Number(args.hours ?? 4);
const minutes = Number(args.minutes ?? hours * 60);

if (!Number.isFinite(minutes) || minutes <= 0) {
  console.error("Invalid threshold. Provide --hours or --minutes greater than 0.");
  usage(2);
}

const thresholdMs = minutes * 60 * 1000;
const nowMs = Date.now();

// This repo uses git worktrees. Always use direct/no-daemon mode for bd commands.
const BD = "npx bd --no-daemon";

function execBdJson(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** @type {Array<{id: string, status?: string, updated_at?: string, updatedAt?: string, title?: string}>} */
let issuesRaw = "";
try {
  issuesRaw = execBdJson(`${BD} list --status in_progress --json`);
} catch (err) {
  const stderr = String(err?.stderr ?? err?.output?.[2] ?? err?.message ?? "");
  if (stderr.includes("Database out of sync with JSONL")) {
    console.log("bd database out of sync; running `bd sync --import-only`…");
    execSync(`${BD} sync --import-only --json`, { stdio: "inherit" });
    issuesRaw = execBdJson(`${BD} list --status in_progress --json`);
  } else {
    throw err;
  }
}

const issues = JSON.parse(issuesRaw);

const stale = issues
  .map((issue) => {
    const updatedAtRaw = issue.updated_at ?? issue.updatedAt;
    const updatedAtMs = updatedAtRaw ? Date.parse(updatedAtRaw) : Number.NaN;
    const ageMs = Number.isFinite(updatedAtMs) ? nowMs - updatedAtMs : Number.NaN;
    return { issue, ageMs };
  })
  .filter(({ ageMs }) => Number.isFinite(ageMs) && ageMs >= thresholdMs)
  .sort((a, b) => b.ageMs - a.ageMs);

if (stale.length === 0) {
  console.log("No stale in_progress issues found.");
  process.exit(0);
}

if (args.dryRun) {
  console.log(`Would reopen ${stale.length} stale issue(s):`);
  for (const { issue, ageMs } of stale) {
    const hoursAgo = (ageMs / (60 * 60 * 1000)).toFixed(2);
    console.log(`- ${issue.id} (${hoursAgo}h ago) ${issue.title ?? ""}`.trim());
  }
  process.exit(0);
}

for (const { issue, ageMs } of stale) {
  const hoursAgo = (ageMs / (60 * 60 * 1000)).toFixed(2);
  console.log(`Reopening ${issue.id} (${hoursAgo}h ago)…`);
  execSync(`${BD} update ${issue.id} --status open --json`, { stdio: "inherit" });
}
