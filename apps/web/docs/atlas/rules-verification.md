# Rules verification checklist

Use this checklist monthly (or when a platform announces instruction changes) to keep Scan rules accurate.

## Cadence
- Verify once per month.
- Verify immediately after major platform updates.

## Checklist
1. Review official docs for each platform:
   - GitHub Copilot
   - Copilot CLI
   - Claude Code
   - Gemini CLI
   - Codex CLI
   - Cursor
   - Windsurf
2. Confirm expected instruction paths and precedence rules.
3. Update `atlas/facts/<platform>.json`:
   - `docHome` (primary docs URL)
   - `claims[*].evidence` (URLs + excerpts)
   - `lastVerified` (ISO timestamp, UTC)
4. If rules changed, update simulator logic:
   - `src/lib/atlas/simulators/insights.ts`
   - `src/lib/atlas/simulators/diagnostics.ts`
   - Tool-specific simulation code in `src/lib/atlas/simulators/tools/`
5. Run tests:
   - `npm run compile`
   - `npm run lint`
   - `npm run test:unit`
6. Capture screenshots if UI copy changes:
   - `docs/screenshots/spec-v21/scan-rules-meta.png`

## Notes
- Keep scans local-only; do not log repository paths in evidence.
- Link relevant changes in the release notes when rules shift.
