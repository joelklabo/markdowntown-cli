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
- **Diagnostic.data**: include stable fields (`ruleId`, `title`, `suggestion`, `severity`, `fingerprint`, `category`, `docUrl`, `evidence`, `paths`, `tools`, `quickFixes`).

## Current Diagnostics (MD000..MD012, MD015)

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
| MD008 | warning | Discovery | scan warning `CIRCULAR_SYMLINK` | Circular symlink detected | Break the symlink loop | `warningCode`, `warningMessage` | no | none |
| MD009 | info | Discovery | scan warning `UNRECOGNIZED_STDIN` | Stdin path not recognized | Add to registry or remove stdin path | `warningCode`, `warningMessage` | no | none |
| MD010 | warning | Discovery | scan warning `EACCES`/`ERROR`/`ENOENT` | Scan warning encountered | Fix permissions or registry path | `warningCode`, `warningMessage` | no | none |
| MD011 | warning | Content | `contentSkipped == "binary"` | Binary config skipped | Replace with text config or remove | `contentSkipped`, `sizeBytes` | no | Unnecessary |
| MD012 | warning | Validity | Missing required frontmatter key for multi-file kinds (skills/prompts) | Missing frontmatter identifier | Add required identifier | `requiredKeys`, `toolId`, `kind` | yes (insert frontmatter stub) | none |
| MD015 | warning | Validity | Unknown toolId in frontmatter | Unknown toolId | Replace with closest match | `toolId`, `replacement` | yes (replace toolId) | none |

Notes:

- MD000 and MD015 are LSP-only today (not scan/audit rules).
- MD001 already skips multi-file kinds and known override pairs.
- MD002, MD004, and MD011 are tagged `Unnecessary` when the config is effectively ignored.

## Remaining Gaps

- `CONFIG_CONFLICT` scan warnings are not surfaced directly; MD001 covers conflicts but drops the scan warning message and path context.
- No rule exists for configs shadowed by higher-precedence files (e.g., a user config that is always overridden by repo config).
- Deprecated file names and legacy paths are not surfaced as `Deprecated` diagnostics.
- Frontmatter schema validation (unknown keys, invalid enum values, invalid glob syntax) is not yet covered.

## Proposed Rule Expansion (MD013+)

These rules can be implemented using scan metadata without reading file content, unless noted.

| ID | Severity | Category | Trigger | Message summary | Suggestion | Evidence keys | Quick Fix | Tags |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MD013 | info | Scope/Precedence | Config is shadowed by higher-precedence file | Config is shadowed | Remove or move config | `shadowedBy`, `loadBehavior` | no | Unnecessary |
| MD014 | info | Validity | Deprecated filename or legacy path detected | Deprecated config path | Rename to supported filename/path | `deprecatedPath`, `replacement` | yes (rename) | Deprecated |
| MD016 | warning | Validity | Frontmatter contains unknown keys or invalid enum values | Invalid frontmatter value | Remove or correct invalid keys/values | `field`, `value`, `allowed` | no | none |
| MD017 | warning | Validity | Invalid `applyTo` glob syntax | Invalid applyTo glob | Fix glob syntax | `applyTo`, `error` | no | none |

## Copy Gaps and Improvements

- MD005 should surface candidate repo paths in related info to make the suggestion actionable.
- Shadowed configs (proposed MD013) should use `Unnecessary` tag and a hint severity.
- Consider a "Disable rule" quick fix for noisy diagnostics to streamline triage (now implemented for VS Code settings).

## Follow-on Tasks

- Implement proposed rules in the audit engine (see bd: markdowntown-cli-p4i).
- Add diagnostics metadata mapping and tagging in LSP (see bd: markdowntown-cli-g7u).
- Add settings + capability gating for diagnostics (see bd: markdowntown-cli-4r0).
