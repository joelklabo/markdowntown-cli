# Markdowntown Monorepo Merge Plan

## Objective
Unify the CLI, web app, and shared docs into a single repo without breaking CLI/LSP workflows. Establish one canonical source of truth for specs, user guidance, and design system references.

## Canonical sources
- **CLI specs (SSOT):** `cli/docs/scan-spec-v1.md`, `cli/docs/audit-spec-v1.md`, `cli/docs/suggest-spec-v1.md`.
- **Architecture plan:** `docs/architecture/monorepo-merge-plan.md`.
- **User guide:** `docs/USER_GUIDE.md` (monorepo entry point).
- **Design system:** `docs/DESIGN_SYSTEM.md` (canonical token + component guidance).

## Phases
1. **Docs consolidation**
   - Move duplicate guides into root `docs/`.
   - Keep CLI specs in `cli/docs/` and link to them from `docs/`.
2. **Workflow alignment**
   - Ensure `AGENTS.md` and model instructions cover CLI + web workflows.
   - Standardize test commands for CLI, web, and docs-only updates.
3. **Release + CI alignment**
   - Follow `docs/architecture/monorepo-merge-plan.md` for CI matrix and tagging strategy.

## References
- `docs/architecture/monorepo-merge-plan.md`
- `docs/qa/monorepo-merge-smoke.md`
