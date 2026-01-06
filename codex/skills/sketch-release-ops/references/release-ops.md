# Release Checklist

This checklist is the final gate before public launch. It combines QA, DevTools, logs, Playwright coverage, and proof video requirements.

## 1) Preflight
- [ ] Pull latest `main` and confirm a clean working tree.
- [ ] Verify required env vars are present in the target environment (see `docs/deploy.md`).
- [ ] Confirm `DEFAULT_PROVIDER`, `OPENAI_IMAGE_MODEL`, and `GEMINI_IMAGE_MODEL` match the intended defaults.

## 2) QA Gates (must pass)
- [ ] **Dev readiness**: complete every gate in `docs/dev-readiness.md`.
- [ ] **DevTools checks**:
  - [ ] Chrome DevTools Console: no errors during the full flow.
  - [ ] Network: `/api/convert` returns 200 (no 4xx/5xx in the happy path).
  - [ ] Performance: loading states visible; no UI freezes on mobile.
- [ ] **Log review**:
  - [ ] Tail server logs and verify no runtime errors during upload/convert.
  - [ ] Confirm provider timing logs appear when telemetry is enabled.
- [ ] **Playwright**:
  - [ ] `pnpm test:e2e tests/e2e/mobile-flow.spec.ts`
  - [ ] `pnpm test:e2e tests/e2e/visual.spec.ts`
- [ ] **Unit checks**:
  - [ ] `npm run compile`
  - [ ] `npm run lint`
  - [ ] `npm run test:unit`

## 3) Proof Video (required)
- [ ] Record the flow following `docs/proof-video.md`.
- [ ] Verify the video includes upload, prompt selection, convert, and before/after toggle.
- [ ] Archive the recording under `proofs/` with the current date.

## 4) Monitoring + Telemetry (launch day)
- [ ] Enable telemetry during launch testing:
  - [ ] Set `ENABLE_TELEMETRY=true` for server logs.
  - [ ] Set `NEXT_PUBLIC_ENABLE_TELEMETRY=true` for client-side preview events.
- [ ] Validate log visibility for:
  - [ ] `convert_start`, `convert_success`, and `convert_error` entries.
  - [ ] Error codes: `missing_api_key`, `provider_error`, `payload_too_large`, `prompt_too_long`.
- [ ] Track health indicators:
  - [ ] 4xx/5xx error rate on `/api/convert`.
  - [ ] p95 generation latency.
  - [ ] Upload size rejects.

## 5) Launch
- [ ] Run the smoke flow on mobile (iOS + Android if possible).
- [ ] Verify `/health` and `/api/health` reflect correct configuration.
- [ ] Confirm CSP + security headers are present (see `docs/deploy.md`).

## 6) Post-Launch Watchlist (first 24 hours)
- [ ] Monitor error rate spikes and timeouts.
- [ ] Capture and triage any new console errors.
- [ ] Create bd tasks for any regressions, refactors, or UX gaps discovered.

## Go/No-Go
- [ ] All QA gates pass with evidence (logs + screenshots).
- [ ] Proof video recorded and reviewed.
- [ ] Monitoring signals are visible and stable.
