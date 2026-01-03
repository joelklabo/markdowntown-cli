# YOUR JOB:

1. Clear stale work: run `node scripts/bd-reset-stale.mjs --hours 4` (or `--minutes 30`) to reopen any `in_progress` older than the threshold.
2. Ask `bd ready` what to do.
3. Before starting, set yourself on the issue (`bd update <id> --status in_progress`).
4. Work on it.
5. Check your work, run tests.
6. Mark it as 'done'.
7. If you stop before done, reset to `open` (`bd update <id> --status open`) to avoid stale in-progress.
8. Create new issues/epics for any necessary work or improvements found.
9. Commit.
10. Push.
11. GO BACK TO 1!

# IMPORTANT:

- NEVER ask which issue you should pick next, use your best judgement and pick one.
- ALWAYS create new issues/epics if you come across something in the course of your work that should be fixed or improved.
- NEVER leave an issue marked `in_progress` if you are stopping work. Reset it to `open` before you leave.
- NEVER give me a summary, or a status report. Just do "Your Job" (See above)

# NOTE:
- If you ever see this error, run `bd doctor` for next steps:
    "⚠️  WARNING: JSONL file hash mismatch detected (bd-160)
     This indicates JSONL and export hashes are out of sync.
     Clearing export hashes to force full re-export."

# VALID STOP REASONS:
- stop reasons: `bd ready` (no tasks), unrecoverable error after retries.

# INVALID STOP REASONS:
- "just reporting progress", "task looks hard", "I've used a lot of tokens", "status update".

# BD issue planning tips
- Turn each outcome into an epic and break it into tasks that can be finished in under 2 days; write acceptance criteria on creation (`bd create --acceptance`).
- Use explicit dependencies so blocked work is visible (`bd dep add --blocks child parent`) and prefer a single blocking chain per stream.
- Keep statuses honest: move work to `blocked` only when a concrete dependency exists; `bd ready` should list all unblocked work.
- Attach design links or artifacts in comments; add area/discipline labels and priority (P0-P4) when creating issues.
- When you have a plan document, bulk create tasks from markdown with `bd create -f plan.md` and set the epic via `--parent <epic-id>` so they inherit context.
- Normalize priorities: P0 = prod down, P1 = sprint goal, P2 = nice-to-have, P3/4 = backlog. Put only 1–3 issues in-progress.
- For design/system work: create epics per surface (nav/landing/browse/detail/builder) and shared tracks (tokens, motion, content, QA). Link shared tracks as blockers of surface work.
- Include definition of done in acceptance: visual parity (light/dark), a11y pass, tests/baselines updated, docs updated, no hex lint failures.

# BD issue planning quick reference
- Capture acceptance and priority on creation (`bd create --acceptance --priority Px`); add labels for area/discipline.
- Break plans into epics per surface/track; size child tasks to <2 days; add explicit deps (`bd dep add --blocks child parent`) so `bd ready` stays accurate.
- Keep only concrete blockers in `blocked`; otherwise use `open`/`in_progress`. Run `bd stale` to clear old in-progress work.
- Bulk import from plan docs with `bd create -f plan.md --parent <epic>` to keep context linked.
- Normalize priorities: P0 prod-down, P1 sprint goal, P2 nice-to-have; keep 1–3 concurrent `in_progress`.
- Add links (designs/PRDs) as comments; prefer single blocking chain per stream.
