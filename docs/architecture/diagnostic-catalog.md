# Markdowntown Diagnostics Catalog

## Purpose

This catalog documents the diagnostics emitted by the audit engine and LSP adapter, plus the scan warnings and entry states that should become diagnostics. It is the source of truth for rule IDs, copy, and LSP metadata usage.

Scope:

- Audit rules (MD000+)
- Scan warnings and entry states
- Proposed rule expansion based on scan metadata

## Taxonomy

### Categories

- **Conflict**: multiple configs that cannot coexist.
- **Validity**: malformed or unreadable config content.
- **Content**: empty or binary files.
- **Scope/Precedence**: repo vs user/global coverage, shadowed configs.
- **Discovery**: scan-time issues (unrecognized stdin, symlinks, root errors).
- **Registry**: registry location or parse failures.

### Severity Guidelines

- **Error**: breaks usage or produces incorrect behavior for repo-wide collaboration.
- **Warning**: likely to confuse or reduce determinism.
- **Info**: non-blocking guidance.
- **Hint**: low-urgency suggestions.

### LSP Metadata Mapping

- **Diagnostic.codeDescription**: link to rule doc (audit spec or catalog anchor).
- **Diagnostic.tags**: use `Unnecessary` for shadowed/ignored configs and `Deprecated` for obsolete file names.
- **Diagnostic.relatedInformation**: include suggestion, tools, and a short list of related config paths.
- **Diagnostic.data**: include stable fields (`ruleId`, `title`, `suggestion`, `evidence`, `paths`, `tools`, `quickFixes`).

## Current Diagnostics (MD000..MD007)

| ID | Severity | Category | Trigger | Message summary | Suggestion | Evidence keys | Quick Fix | Tags |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MD000 | error | Registry | LSP error path (registry or scan failure) | `LSP error: <err>` | Set registry path or fix scan error | `suggestion` | no | none |
| MD001 | error | Conflict | Multiple configs for same tool/kind/scope (single-file kinds only) | Conflicting configs | Keep one config or use override pair | `scope`, `toolId`, `kind` | no | none |
| MD002 | warning | Scope/Precedence | Repo config is gitignored | Repo config ignored by git | Remove from .gitignore or move | `gitignored` | yes (allow gitignore) | Unnecessary (optional) |
| MD003 | error | Validity | Invalid YAML frontmatter | Invalid YAML frontmatter | Fix syntax or remove | `frontmatterError` | yes (remove frontmatter) | none |
| MD004 | warning | Content | Empty config file | Config file is empty | Add instructions or delete | `warning`, `sizeBytes` | yes (insert placeholder) | Unnecessary |
| MD005 | info | Scope/Precedence | User/global config exists without repo config | No repo-scoped config | Add repo config | `detectedScopes`, `candidatePaths` | yes (create repo config) | none |
| MD006 | error/warn | Validity | Config unreadable (EACCES/ENOENT/ERROR) | Config file could not be read | Fix permissions/path | `error` | no | none |
| MD007 | warning | Conflict | Duplicate frontmatter identifiers in multi-file kinds | Duplicate frontmatter value | Make identifiers unique | `scope`, `tool`, `kind`, `field`, `value`, `count` | yes (remove duplicate frontmatter) | none |

Notes:

- MD000 is LSP-only today (not a scan/audit rule).
- MD001 already skips multi-file kinds and known override pairs.
- MD002 and MD004 could be tagged `Unnecessary` when the config is effectively ignored.

## Scan Warnings and Entry States (Not Yet Mapped)

Source: `docs/scan-spec-v1.md` and `internal/scan`.

Warnings (scan output):

- `CONFIG_CONFLICT`: conflict detected at scan time.
- `UNRECOGNIZED_STDIN`: stdin path did not match any registry pattern.
- `CIRCULAR_SYMLINK`: circular symlink detected during traversal.
- `EACCES` / `ERROR`: permission or unexpected scan failures (root, pattern load, file access).

Entry states (per config entry):

- `warning: "empty"` (already mapped to MD004).
- `error: EACCES/ENOENT/ERROR` (mapped to MD006 for entries, but scan warnings are not surfaced).
- `contentSkipped: "binary"` (not mapped).
- `frontmatterError` (mapped to MD003).

## Proposed Rule Expansion (MD008+)

These rules can be implemented using scan metadata without reading file content, unless noted.

| ID | Severity | Category | Trigger | Message summary | Suggestion | Evidence keys | Quick Fix | Tags |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MD008 | warning | Discovery | scan warning `CIRCULAR_SYMLINK` | Circular symlink detected | Break the symlink loop | `warningCode`, `warningMessage` | no | none |
| MD009 | info | Discovery | scan warning `UNRECOGNIZED_STDIN` | Stdin path not recognized | Add to registry or remove stdin path | `warningCode`, `path` | no | none |
| MD010 | warning | Discovery | scan warning `EACCES`/`ERROR` on root/pattern load | Scan warning encountered | Fix permissions or registry path | `warningCode`, `warningMessage` | no | none |
| MD011 | warning | Content | `contentSkipped == "binary"` | Binary config skipped | Replace with text config or remove | `contentSkipped`, `sizeBytes` | no | Unnecessary |
| MD012 | warning | Validity | Missing required frontmatter key for multi-file kinds (skills/prompts) | Missing frontmatter identifier | Add required identifier | `field`, `kind`, `toolId` | yes (insert frontmatter stub) | none |
| MD013 | info | Scope/Precedence | Config is shadowed by higher-precedence file | Config is shadowed | Remove or move config | `shadowedBy`, `loadBehavior` | no | Unnecessary |
| MD014 | info | Registry | Registry missing or multiple registries | Registry not found/ambiguous | Set registry path setting | `registryPath`, `error` | no | none |

## Copy Gaps and Improvements

- MD003 currently hides the YAML error detail; include `frontmatterError` in related info.
- MD006 should surface the error code in the message or related info for clarity.
- MD005 should surface candidate repo paths in related info to make the suggestion actionable.
- MD002/MD004 are effectively ignored by runtime; tag as `Unnecessary` in VS Code.
- Shadowed configs (proposed MD013) should use `Unnecessary` tag and a hint severity.

## Follow-on Tasks

- Implement proposed rules in the audit engine (see bd: markdowntown-cli-p4i).
- Add diagnostics metadata mapping and tagging in LSP (see bd: markdowntown-cli-g7u).
- Add settings + capability gating for diagnostics (see bd: markdowntown-cli-4r0).
