# Server-side validation patterns

## Shared validators
- `src/lib/validation.ts` for section/snippet content rules and limits.
- `src/lib/skills/skillValidate.ts` for Skills payload validation.
- `src/lib/uam/uamValidate.ts` + `src/lib/uam/uamLint.ts` for UAM v1 validation/linting.

## Typical API route flow
1. Parse and normalize input (trim strings, defaults).
2. Validate payload using shared helper(s).
3. Return 400 with a human-readable error string.
4. Only write to Prisma after validation passes.

## Safety utilities
- `src/lib/compile/pathSafety.ts` validates archive paths before writing.
- `src/lib/tags.ts` normalizes/validates tag inputs.

## Error messaging
- Prefer explicit error messages used by UI (e.g., "Title is required").
- Keep error strings stable; update UI tests if they change.
