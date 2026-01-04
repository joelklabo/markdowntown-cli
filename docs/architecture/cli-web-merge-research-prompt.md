# Deep research prompt: CLI + web merge

## Mission
You are an external research agent. Produce a detailed plan and risk assessment for merging the CLI and web app into a single monorepo while preserving CLI/LSP behavior and enabling CLI ↔ web sync (snapshots + patches).

## Context (current repo layout)
The repo already contains both CLI and web code:
- `cli/` — Go CLI + internal libraries + VS Code extension.
- `apps/web/` — Next.js web app with API routes and UI.
- `docs/` — architecture/design/UX notes.
- `.codex/skills/` — repo-specific skills for Codex CLI.

### Key folders to review
- CLI code: `cli/cmd/markdowntown`, `cli/internal/*`.
- Web code: `apps/web/src/app/api/cli/*`, `apps/web/src/lib/cli/*`.
- Architecture docs: `docs/architecture/*`.
- UX docs: `docs/ux/*` and `docs/ui/*`.
- Agent instructions: `AGENTS.md` (root) + any nested `AGENTS.md` files.

## Required topics to cover
### 1) Folder structure + ownership
- Confirm current monorepo structure and note any conflicts between CLI + web tooling.
- Identify shared packages that should become SSOT (scan/audit rules, schemas, registry).

### 2) Auth flow (device flow + token storage)
- CLI command: `markdowntown login`.
- Core docs: `docs/architecture/cli-auth-device-flow.md`.
- Web endpoints: `apps/web/src/app/api/cli/device/*`.
- Local storage: `cli/internal/auth/*` + `cli/internal/config/*`.

### 3) Sync protocol (CAS + patches)
- Protocol doc: `docs/architecture/sync-protocol.md`.
- Data model: `docs/architecture/cli-sync-data-model.md`.
- CLI sync implementation: `cli/internal/sync/*`.
- Web endpoints: `apps/web/src/app/api/cli/patches/*` + audit endpoints.

### 4) Shared logic strategy
- Decision doc: `docs/architecture/shared-logic-strategy.md`.
- Determine WASM vs sidecar viability, fallback triggers, and build pipeline.

### 5) Developer workflows
- Go:
  - `cd cli && make lint`
  - `cd cli && make test`
- Web:
  - `pnpm -C apps/web lint`
  - `pnpm -C apps/web compile`
  - `pnpm -C apps/web test:unit`
  - `pnpm -C apps/web lint:md`
- Monorepo CI expectations (Go + Node + VS Code extension must stay green).

### 6) Security + privacy considerations
- Explicitly compare CLI vs web threat models and auth flows.
- Call out token handling, log redaction, and data retention policies.
- Note any offline/local-first requirements and their impact on sync design.

### 7) Unified testing + dev loop
- Propose a unified testing strategy for shared logic (CLI + web).
- Address dev-loop ergonomics (hot reload / fast iteration for shared code).

### 8) Codex CLI support requirements
- Read `AGENTS.md` (root) and any nested `AGENTS.md` files.
- Enumerate repo skills from `.codex/skills/*`.
- Note any required slash commands or workflow policies for Codex CLI.

## Output format
Provide a structured report with:
1. **Summary** of merge readiness and top risks.
2. **Proposed repo layout** with ownership boundaries.
3. **Sync flow diagram** (textual is fine) tying CLI + web endpoints.
4. **Open questions** that must be resolved before merge.
5. **Recommended milestones** (ordered) with dependencies.
6. **Risk mitigation** for security, data integrity, and tooling.

## Edge cases to explicitly address
- Monorepo path changes and how they affect CLI paths/docs.
- Divergent tooling between Go and Node (version pinning, CI matrix).
- Sensitive data handling (token storage, log redaction).
- Offline/local-first expectations and resume behavior.
- Platform-specific constraints (fs vs browser APIs).

## Notes
- Prefer concrete file paths in your response.
- Call out any gaps in docs or missing decision points.
- Assume the goal is a single main branch with CI green at all times.
