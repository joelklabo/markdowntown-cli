# Primary flow spec (UX clarity)

Last updated: Dec 28, 2025

## Primary persona
- New visitor with a repo who needs to understand how instruction files (AGENTS.md, agents.md, tool-specific files) will be loaded.

## Core user stories (guide for interfaces)
1) As a repo owner, I scan a folder to see what instruction files load and go straight to Workbench to export agents.md.
2) As a team member, I start from a public artifact in Library and open it in Workbench to customize and export.
3) As a maintainer, I paste existing instructions into Translate to convert and export agents.md quickly.
4) As a new user, I land on the homepage and immediately understand the 3-step path to value with a single primary CTA.
5) As a cautious user, I want to confirm scans are local-only and no repo contents leave my device.

## Flow objective
- Make it obvious how to go from a folder scan to an exported agents.md.
- Remove ambiguity about which files are used and what to do next.
- Keep the primary surfaces limited to Scan, Workbench, Library, Translate, and Docs.

## Terminology
- Use **Scan** in user-facing copy. "Atlas" is internal routing only and should not appear in UI text.
- Use **Export** with specific actions (Copy to clipboard vs Download file) in CTAs and success messaging.

## Canonical flow (scan -> understand -> build/export)
1. **Start: Scan a folder**
   - Entry: `/atlas/simulator` (folder scan is the default action).
   - User action: pick a local folder and run the scan (directory picker or folder upload fallback).
   - Output: list of loaded instruction files, ordering/precedence, and missing files, plus scan summary badges.
2. **Review insights**
   - User action: read what loaded, what did not, and why.
   - Output: clear next step prompt (primary CTA) that routes to Workbench when ready.
3. **Build in Workbench**
   - Entry: `/workbench` (prefilled with scan context when available).
   - User action: assemble scopes and blocks; edit text.
   - Output: updated agents.md preview.
4. **Export or copy**
   - User action: copy markdown or download agents.md to disk.
   - Output: saved file or clipboard content with confirmation (toast or success row).

## Handoff persistence
- Persist handoff context in URL params + sessionStorage (see `docs/architecture/core-flow-handoff.md`).
- Refresh/back should restore the most recent handoff context for the same session.

## Success state
- User exports or copies a valid agents.md that matches their tool context, with clarity on where the content came from.

## Secondary flows
- **Library-first**: Browse templates/snippets in Library -> open in Workbench.
- **Translate**: Convert existing instructions into agents.md format.
- **Direct to Workbench**: Open Workbench without scan context and start from scratch.
- **Docs**: Read how the system interprets instructions and precedence.

## Primary entry points
- Home hero CTA -> `/atlas/simulator` (Scan a folder).
- Navigation primary -> `Scan` -> `/atlas/simulator`.
- Secondary CTA -> `/workbench` (Open Workbench).
- Tertiary CTA -> `/library` (Browse Library; use once on Home or Library preview).
- Tertiary entry points (de-emphasized): `/templates`, `/tags`, `/atlas`.

## Home layout mapping (scan-first)
1. Hero: scan-first value + primary/secondary CTAs.
2. Quick-start steps: Scan → Review → Export.
3. Proof/preview: confirms Workbench output readiness.
4. Minimal Library preview: secondary discovery path only.
5. Final CTA block: reinforce Scan → Workbench.

## Related documentation
- User guide: `docs/USER_GUIDE.md`.
- Scan quickstart: `docs/atlas/scan-quickstart.md`.

## Required UI signals
- One primary CTA per surface (scan, then build, then export).
- Show the scan results summary above the first next-step CTA.
- Use consistent language: "Scan", "Workbench", "Export", with specific export actions.
- Include explicit counts for loaded/missing/ignored files in scan summaries.
- Preserve scan context (tool + cwd) when sending users to Workbench.
- Document recovery affordances (retry on permission error, fall back to folder upload).

## CTA hierarchy rules
- **Home page:** one primary CTA (Scan a folder), one secondary CTA (Open Workbench), tertiary link (Browse Library) used once.
- **Ready state:** primary CTA is **Open Workbench**; secondary actions are Share (Copy summary) and Download report.
- **Error/warning states:** one primary fix action per step (Copy template, Set cwd, Switch tool). Secondary actions are optional and should not compete.
- **No scan state:** primary CTA is Scan a folder (or Upload folder when picker is unavailable); secondary CTA is Paste paths.

## Critical edge cases
- **No instruction files found**: explain what is expected and link to Docs.
- **Multiple tool targets**: prompt user to pick a target before building.
- **Permission errors**: explain how to grant read access and retry.
- **Unsupported picker**: direct users to the folder upload input.
- **Truncated scan**: explain that large folders should be narrowed or excluded.
- **Partial success**: call out skipped/invalid files and keep the primary CTA visible.
- **Overwrite conflict**: if a new scan would replace manual edits, warn and provide replace/merge guidance.
