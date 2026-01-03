# Public Browse/Copy/Builder E2E Regression Plan
Date: 2025-12-01  
Issue: markdowntown-7z8.36

## Flows to cover
- Landing → browse → snippet detail → copy/download.
- Browse with filters/sorts/tags → quick copy.
- Template detail → form fill → copy/download → use template → builder.
- Builder: add snippets, arrange, preview, export; auth gate on save as Document.
- Tag cloud navigation; related content links.

## Environments
- Prefer Playwright against local/staging with `public_library` flag on and seeded public data.
- Skip GitHub OAuth dependency; use mock auth or test user env vars if available.

## Test heuristics
- Validate cache headers? (optional; integration tests can cover headers).
- Ensure copy buttons copy expected content (use clipboard read if permitted; else text content assertion).
- Check that private/unlisted content is not shown in public lists.
- Verify CTA gating flows show sign-in prompt and resume action after mocked login.

## Setup
- Seed fixtures: public snippets/templates/documents with tags/kinds, trending stats.
- Feature flags: enable `public_library`, `builder_v2`, `templates_v1`.
- Mock analytics endpoints to avoid network noise.

## Cases
1) Landing modules render (featured/trending/new/tag cloud).
2) Browse search returns relevant item; filter by tag; sort by most copied.
3) Snippet detail rendered/raw match; stats present; add to builder.
4) Template detail form validation; render updates; use template → builder preloads fields.
5) Builder drag/reorder reflected in preview; export button provides markdown; save gate appears when unauthenticated.
6) Tag page lists items; clicking card goes to detail.
7) Related content module shows items with shared tags.

## Tooling
- Playwright test suite under `__tests__/e2e` with fixtures and mock auth helper.
- CI job to run headless; allow skip via env if secrets missing.

## Exit criteria
- All flows automated and passing in CI on seeded data.
- Docs updated for running e2e locally with feature flags + seed script.
