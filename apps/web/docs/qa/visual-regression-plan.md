# Visual Regression & Interaction Smoke Plan (Dec 2025)

## Scope pages (desktop + mobile)
- `/` (hero, featured, guided build band)
- `/browse` (filters, cards, empty state)
- `/snippets/[slug]` and `/templates/[slug]` (quality strip, tabs, related)
- `/builder` (3-pane layout)
- `/documents` (list + empty state)
- `/tags` (tag grid)
- `/atlas` (landing + compare widgets)
- `/docs` (docs landing + detail cards)
- `/changelog` (list + entry layout)
- `/privacy` and `/terms` (long-form text layout)

## Baselines
- Tool: Playwright screenshot tests per route and breakpoint (1280x720, 390x844).
- Store baseline images in `__tests__/__screenshots__` (or Playwright default).
- Update snapshots only via intentional run; review diffs in PRs.
- `pnpm test:visual` clears `NO_COLOR` to avoid Playwright FORCE_COLOR warnings while keeping output readable.
- Ensure the Living City header band is visible in `/`, `/browse`, `/builder`, `/atlas`, and `/docs` baselines.
- Interaction E2E specs run via Vitest (`npm run test:e2e -- <SpecName>`), not the Playwright test CLI.
- Known dev warnings to ignore vs investigate are listed in `docs/qa/known-warnings.md`.
- If the dev server logs Watchpack `EMFILE` warnings or routes 404 during QA, restart with Watchpack polling (`WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 pnpm dev`) and see `docs/DEV_ONBOARDING.md`.

## Smoke interactions
- Nav: open/close search sheet; theme toggle; command palette open+close.
- Browse: apply sort, add/remove tags, load more.
- Detail: copy/download actions; rendered/raw tab switch.
- Builder: create section, edit title, save (mocked), preview renders.
- Onboarding (when added): checklist completes first item.

## CI
- Add Playwright visual job gated on changed UI files.
- Fail CI on unexpected diffs; allow approve/update via `PLAYWRIGHT_UPDATE_SNAPSHOTS=1`.

## Manual dispatch (Nightly Visual & Bundle Checks)
- UI: GitHub → Actions → "Nightly Visual & Bundle Checks" → Run workflow → branch `main`.
- CLI: `gh workflow run nightly-visual.yml --ref main` requires repo write access plus a token with `workflow` scope (`gh auth refresh -s workflow`).
- If CLI returns HTTP 403, use the UI run or request elevated permissions from a repo admin.

## CI artifact snapshot recovery (fallback)
- Use when Docker/Linux reproduction is unavailable (e.g., containerd temp dir I/O errors).
- Identify the failing run in GitHub Actions and note the `nightly-visual-artifacts` ID.
- Download artifacts: `gh run download <run-id> --name nightly-visual-artifacts --dir /tmp/nightly-visual-artifacts`.
- Replace linux snapshots with the `*-actual.png` files from the artifact:
  - Example: `cp /tmp/nightly-visual-artifacts/translate-Translate-page-visual-light-mode-chromium-mobile/translate-light-actual.png __tests__/visual/translate.spec.ts-snapshots/translate-light-chromium-mobile-linux.png`.
- If darwin snapshots drift in local runs with `NEXT_PUBLIC_WORDMARK_ANIM_V1=false`, update locally:
  - `BASE_URL=http://localhost:3000 NEXT_PUBLIC_WORDMARK_ANIM_V1=false env -u NO_COLOR pnpm exec playwright test --config=playwright-visual.config.ts --update-snapshots=all <specs>`.
- Validate size/viewport with `sips -g pixelWidth -g pixelHeight <file>` before committing.

## Acceptance per PR
- Baseline updated or unchanged for scoped pages.
- No hex lint failures; light/dark checked at least for `/` and `/browse`.
