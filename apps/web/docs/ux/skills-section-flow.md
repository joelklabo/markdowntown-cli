# Skills section flow (UX)

Last updated: Dec 27, 2025

## Objectives
- Let users discover skills by target (Codex CLI, Copilot CLI, Claude Code).
- Support a fast list → detail → add-to-Workbench flow.
- Make export intent clear (skill supported targets and output shape).

## Entry points
- Primary navigation: **Skills** (global nav).
- Command palette: **Open Skills** with target quick filters.
- Workbench: CTA to browse skills when no skills are present.

## Primary flow
1. **Skills list (/skills)**
   - User filters by target and searches keywords.
   - List shows skill name, short description, and target badges.
   - Primary CTA: **View skill** (detail).
   - Secondary CTA: **Add to Workbench** (if user wants to skip detail).

2. **Skill detail (/skills/[slug])**
   - Shows the skill description and params (if any).
   - Shows supported targets and export behavior summary.
   - Primary CTA: **Add to Workbench**.

3. **Workbench handoff (/workbench?skill=...)**
   - Workbench opens with skill added to capabilities list.
   - Skills panel highlights the newly added skill.
   - Export panel reflects target-specific skill outputs.

## Empty states
- **No skills found**: show CTA to open Workbench and create a skill.
- **No filters match**: suggest clearing filters + show all targets.

## Edge cases
- Skill exists but has no targets → show warning chip and allow add.
- Skill not found → redirect to Skills list with a toast.
- Capability params invalid → display error badge and allow edit in Workbench.

## Assumptions
- Skills are stored as artifacts of type SKILL.
- Skill params are optional JSON and validated on save.
- Add-to-Workbench uses URL params or session storage for handoff.

## Open questions
- Should “Add to Workbench” require authentication?
- Should skills be publicly searchable by default, or only seeded content initially?
