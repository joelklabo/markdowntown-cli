# markdowntown audit

Summary: 3 errors, 2 warnings, 2 info

## Errors

- [MD001] Config conflict: ./.cursor/rules.md (+1 more)
  - Affected paths:
    - ./.cursor/rules.md
    - ./.cursor/rules2.md
  - Suggestion: Keep exactly one config for this tool/kind/scope. Delete or rename extras, or use a documented override pair.
- [MD003] Invalid YAML frontmatter: ./AGENTS.md
  - Suggestion: Fix the YAML frontmatter syntax or remove it entirely.
- [MD006] Config unreadable: ./secret.md
  - Suggestion: Check the file permissions and ensure the path exists.

## Warnings

- [MD002] Gitignored config: ./.gitignored.md
  - Suggestion: Remove this path from .gitignore or move the file to a tracked location.
- [MD004] Empty config file: ./EMPTY.md
  - Suggestion: Add the intended instructions or delete the file.

## Info

- [MD005] No repo config: <ABS_PATH_1>
  - Suggestion: Add a repo-scoped config for consistent behavior across teammates and CI.
- [MD009] Unrecognized stdin path: ./unknown
  - Suggestion: Add a registry pattern for this path or remove it from stdin.
