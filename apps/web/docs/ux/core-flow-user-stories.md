# Core flow user stories

Last updated: Dec 28, 2025

## Why this exists
These stories define the minimal, high-value paths the UI must support. Every interface update should map to one or more stories.

## User stories
1) **Scan to export (primary)**
   - As a repo owner, I scan a folder to see what instruction files load and go straight to Workbench to export agents.md.
   - Success criteria:
     - Scan summary lists counts for loaded, missing, and ignored files.
     - Primary CTA “Open Workbench” is visible above the fold and carries scan context.
     - Export action completes (copy or download) and shows a success confirmation.

2) **Library to Workbench (secondary)**
   - As a team member, I start from a public artifact in Library and open it in Workbench to customize and export.
   - Success criteria:
     - Library list and preview highlight the “Open in Workbench” action.
     - Workbench opens with the chosen artifact preloaded and labeled.
     - Export action remains the next step with a single primary CTA.

3) **Translate to Workbench (secondary)**
   - As a maintainer, I paste existing instructions into Translate to convert and export agents.md quickly.
   - Success criteria:
     - Translate flow explains input → compile → Workbench handoff.
     - Primary CTA opens Workbench after translation success.
     - Export action completes (copy or download) with success confirmation.

4) **Direct to Workbench (secondary)**
   - As a user without scan context, I open Workbench and start from scratch.
   - Success criteria:
     - Onboarding explains there is no scan context and suggests a next step.
     - Export panel still offers a single primary action once content is ready.

5) **Landing clarity (entry)**
   - As a new user, I land on the homepage and immediately understand the 3-step path to value with a single primary CTA.
   - Success criteria:
     - One primary CTA: Scan a folder.
     - One secondary CTA: Open Workbench.
     - One tertiary link: Library (optional).

6) **Local-only trust (safety)**
   - As a cautious user, I want to confirm scans are local-only and no repo contents leave my device.
   - Success criteria:
     - Scan UI explicitly states local-only scanning.
     - Analytics and logs never include file paths or repo names.

## Recovery + empty states
- **Scan**: Permission denied or unsupported picker shows one primary recovery action (retry or upload folder).
- **Library**: Empty library encourages Scan and keeps “Open in Workbench” secondary.
- **Translate**: Compile failure shows a single retry action with guidance.
- **Workbench**: Missing handoff context shows “Start with Scan” guidance.

## Interfaces touched
- Landing: hero, quick steps, CTA hierarchy.
- Scan: scan results summary, next steps CTA ordering.
- Workbench: onboarding, export panel, success confirmation.
- Library: list preview CTA and copy.
- Translate: input guidance and output CTA.
