# Registry Architecture (v1)

## Responsibilities
- Load the pattern registry from disk with XDG-compliant fallback.
- Enforce strict JSON parsing and schema validation.
- Compile glob/regex patterns for matching.
- Provide tool summaries for `tools list`.
- Validate registry content and documentation URLs.

## Registry Resolution Order
1. `MARKDOWNTOWN_REGISTRY` environment override.
2. `~/.config/markdowntown/ai-config-patterns.json`
3. `/etc/markdowntown/ai-config-patterns.json`
4. Registry file adjacent to the `markdowntown` binary.

If multiple registries are found, fail fast with a clear error.

## Schema Notes
- Strict JSON only (no comments).
- Required fields for each pattern: id, toolId, toolName, kind, scope, paths, type, loadBehavior, application, docs.
- Optional fields: notes, hints, applicationField.

## Pattern Matching
- Default matcher type is glob; regex when `type: "regex"`.
- Case-insensitive matching across all platforms.
- Match against full relative paths (slash-normalized).
- `~` expansion applies for user-scope paths.

## Validation Workflow (`registry validate`)
Checks are executed in order and reported in JSON:
1. Syntax: parse JSON.
2. Schema: required fields and types.
3. Patterns: compile glob/regex.
4. Unique IDs: detect duplicates.
5. Docs reachable: HTTP GET with redirects enabled; non-2xx is a failure.

Network access is required only for docs reachability and should be bounded with timeouts.

## Tools List (`tools list`)
- Aggregate patterns by toolId/toolName.
- Count patterns per tool.
- Deduplicate and sort docs URLs.
- Emit deterministic JSON sorted by toolId.
