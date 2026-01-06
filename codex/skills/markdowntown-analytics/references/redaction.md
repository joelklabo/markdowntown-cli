# Redaction + privacy references

## Code
- `src/lib/analytics.ts` (redactAnalyticsPayload + guardrails)
- `__tests__/lib/analytics.redaction.test.ts` (redaction tests)

## Policy surfaces
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `docs/DEV_ONBOARDING.md` (optional analytics env)
- `docs/runbooks/env-setup.md` (PostHog env vars)

## Rules of thumb
- Do not send file paths, cwd values, or raw content.
- Prefer counts, booleans, and coarse labels.
- Assume analytics can be disabled; UI must still work.
