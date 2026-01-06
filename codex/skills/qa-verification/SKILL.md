---
name: qa-verification
description: Unified QA verification for both web UI and CLI work. Use when tasks require QA evidence, test execution, or verification checklists.
---

# QA Verification

## Overview
Use this skill to gather QA evidence. Choose the section that matches the work type (web UI vs CLI). If both apply, follow both sections.

## Evidence Format
- Record evidence in a `## QA Evidence` section on the task.
- Include: test command(s), screenshots/trace paths (if any), DevTools checks, logs reviewed, and CI status.

## Web UI Verification
Required evidence:
1) Playwright (or repo E2E) tests for affected UI flows.
2) Screenshots of key UI states (store paths in task Files + QA evidence).
3) Chrome DevTools evidence: console + network clean (no errors/warnings) and Issues panel checked.
4) Frontend + backend logs reviewed with no errors/warnings.
5) Playwright trace artifact captured on failure or flake (retain-on-failure or on-first-retry).
6) CI command(s) run with green results.

Workflow:
1) Identify affected UI flows and pages.
2) Run Playwright (or repo-specified E2E) for those flows.
3) Use resilient locators and web-first assertions if tests are added/updated (avoid manual visibility checks).
4) Capture screenshots for key states; store in the repo’s standard screenshot path.
5) Use DevTools (MCP if available) to check console, network, and Issues panel.
6) Review FE/BE logs; fix any errors/warnings.
7) If tests fail or are flaky, collect trace artifacts and record the path.
8) Record QA evidence in the task before closing.

Fallback:
- If DevTools MCP is unavailable, capture Playwright trace/screenshots and browser console logs from the test run, and note the limitation.

Automated confirmation gate:
- Any UI change must complete the Web UI Verification steps before moving on.
- Do not wait for user approval; verification is automated evidence.

## CLI Verification
Required evidence:
1) Command transcripts: command + stdout + stderr + exit code.
2) Non-interactive behavior: flags like `--no-input`, stdin via pipe, and `-` for stdin/stdout when supported.
3) Output formats: `--json` and plain output validated; schema stable if applicable.
4) Config precedence and location checks (flags/env/project/user/system; XDG if used).
5) CI command(s) run with green results.

Workflow:
1) Identify primary commands and flags touched by the change.
2) Run happy-path and failure-path commands; capture exit codes and streams.
3) Validate non-interactive paths (piped stdin, `-` for stdin/stdout).
4) Verify output formats and schema stability.
5) Verify config precedence and storage locations.
6) Record QA evidence in the task before closing.

## Guardrails
- If repo QA instructions conflict with this skill, follow repo rules.
- If the work spans both UI and CLI, apply both checklists.
