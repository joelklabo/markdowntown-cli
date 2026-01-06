# Playwright Workflow (Sketch Magic)

## Standard Commands

### Mobile flow
```
PLAYWRIGHT_PORT=3020 pnpm test:e2e tests/e2e/mobile-flow.spec.ts
```

### Visual baselines
```
PLAYWRIGHT_PORT=3021 pnpm test:e2e tests/e2e/visual.spec.ts
```

### Update snapshots
```
PLAYWRIGHT_PORT=3021 pnpm test:e2e tests/e2e/visual.spec.ts --update-snapshots
```

## Port Conflicts
- Playwright spins up its own dev server; use a fresh port each run.
- If a server is already running, set:
  - `PLAYWRIGHT_EXISTING_SERVER=true`
  - `PLAYWRIGHT_PORT=<your-port>`

## Flake Triage
- If only WebKit fails, inspect `test-results/*/video.webm`.
- Disable animation-related noise by waiting for stable states before screenshot.
- Ensure a consistent viewport (320/390 widths).

## Artifacts
- `test-results/` includes trace, screenshots, and video on failure.
- Visual snapshots live under `tests/e2e/visual.spec.ts-snapshots/`.

## Expected Signals
- No console errors in the mobile flow test.
- Tap targets ≥ 44px on 320px width.
- Visual baselines updated only after intentional UI changes.
