# YOUR JOB:

1. Clear stale work in the tracker; reopen any `in_progress` items older than the threshold.
2. Choose the next task based on priorities.
3. Before starting, set yourself on the issue and mark it `in_progress`.
4. Work on it.
5. Check your work, run tests.
6. Mark it as 'done'.
7. If you stop before done, reset to `open` to avoid stale in-progress.
8. Create new issues/epics for any necessary work or improvements found.
9. Commit.
10. Push.
11. GO BACK TO 1!

# IMPORTANT:

- NEVER ask which issue you should pick next, use your best judgement and pick one.
- ALWAYS create new issues/epics if you come across something in the course of your work that should be fixed or improved.
- NEVER leave an issue marked `in_progress` if you are stopping work. Reset it to `open` before you leave.
- NEVER give me a summary, or a status report. Just do "Your Job" (See above)

# VALID STOP REASONS:
- stop reasons: no tasks available, unrecoverable error after retries.

# INVALID STOP REASONS:
- "just reporting progress", "task looks hard", "I've used a lot of tokens", "status update".

# Issue planning tips
- Turn each outcome into an epic and break it into tasks that can be finished in under 2 days; write acceptance criteria on creation.
- Use explicit dependencies so blocked work is visible and prefer a single blocking chain per stream.
- Keep statuses honest: move work to `blocked` only when a concrete dependency exists.
- Attach design links or artifacts in comments; add area/discipline labels and priority (P0-P4) when creating issues.
- When you have a plan document, bulk create tasks from markdown and keep them linked to the epic.
- Normalize priorities: P0 = prod down, P1 = sprint goal, P2 = nice-to-have, P3/4 = backlog. Put only 1–3 issues in-progress.
- For design/system work: create epics per surface (nav/landing/browse/detail/builder) and shared tracks (tokens, motion, content, QA). Link shared tracks as blockers of surface work.
- Include definition of done in acceptance: visual parity (light/dark), a11y pass, tests/baselines updated, docs updated, no hex lint failures.
