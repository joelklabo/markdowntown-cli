# Codex skills inventory + triggers

## Goal
Provide a curated set of Codex skills that cover core markdowntown workflows: scan → workbench → export, testing, docs, analytics/privacy, and beads (bd) operations.

See `docs/skills/index.md` for the quick overview and maintenance steps.

## Skill inventory

| Skill name | Trigger phrases (examples) | Intended scope | Primary workflows |
| --- | --- | --- | --- |
| markdowntown-bd | "bd issue", "beads workflow", "create task", "update status" | bd CLI usage + repo ops | bd workflow, git hygiene |
| markdowntown-frontend | "UI change", "design system", "tailwind", "layout" | frontend UX + design rules | workbench UX, library/skills UI |
| markdowntown-atlas-scan | "scan flow", "atlas simulator", "folder upload" | scan + simulator logic | scan flow, onboarding funnel |
| markdowntown-workbench | "workbench export", "compile adapters", "targets" | workbench + adapters | build/export pipeline |
| markdowntown-backend | "API route", "Prisma", "migration", "server validation" | backend routes + data layer | API handlers, Prisma, validation |
| markdowntown-testing | "run tests", "playwright", "E2E" | test strategy + commands | testing + validation |
| markdowntown-docs | "update docs", "architecture doc", "UX spec" | docs location + style | docs and content updates |
| markdowntown-analytics | "events", "redaction", "telemetry" | analytics + privacy | analytics/security |

## Workflow coverage map
- **Scan flow**: markdowntown-atlas-scan + markdowntown-frontend (UI/UX changes)
- **Workbench**: markdowntown-workbench + markdowntown-frontend
- **Testing**: markdowntown-testing
- **Docs**: markdowntown-docs
- **Analytics/security**: markdowntown-analytics
- **bd workflow**: markdowntown-bd
- **Backend/data layer**: markdowntown-backend

## Assumptions
- Skills should be terse, referencing repo docs rather than duplicating them.
- Trigger phrases should include both domain keywords (Workbench, Atlas, adapters) and actions (create, export, test).
- Skills should avoid network usage unless explicitly needed.

## Open questions
- Do we need a separate skill for public API routes vs UI components?
- Is there a need for a "release + deploy" skill beyond bd workflow notes?
