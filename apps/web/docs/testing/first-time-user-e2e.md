# First-Time User End-to-End Flow
Date: 2025-12-01
Issue: markdowntown-p8n.1

## Goal
Automate the full journey: a new visitor signs up, creates a snippet, creates an agents.md document, inserts the snippet into the document (including deletion/replace), exports/ downloads, and verifies the markdown content. This narrative defines the user steps, required test data/env, gaps, and assertions for Playwright.

## Preconditions / Test Data
- Test user (GitHub OAuth) with valid creds, or Playwright storage state via `E2E_STORAGE_STATE` as documented in `docs/testing/e2e-auth-notes.md`.
- `E2E_BASE_URL` pointing to dev/staging.
- Clean content namespace (unique titles per run, e.g., suffix timestamp) to avoid collisions.
- File download directory configured for Playwright to read the saved `.md`.

## User Story Steps (happy path)
1) **Land & sign up**
   - Visit `/` and click "Sign in with GitHub" (or use preloaded storage state). Expect redirect back to `/` with avatar visible.
2) **Create snippet**
   - Go to `/snippets/new`.
   - Fill Title: `E2E Snippet {runId}`; Content: `System reminder **bold**`; Tags: `system, e2e`.
   - Submit; assert success toast and redirect shows rendered/raw tabs; copy action is visible.
3) **Create agents.md document**
   - Navigate to `/documents/new`.
   - Title: `E2E agents {runId}`; Description optional; Content: `# My agents\n\nInitial body paragraph.`; Tags: `agents, e2e`.
   - Click "Create document"; land on edit view.
4) **Edit & insert snippet**
   - In the document edit form, delete a portion of the body (e.g., remove "Initial body").
   - Append snippet content (from step 2) to the textarea. For fidelity, store snippet text during creation and assert it appears after insertion.
   - Save changes; expect toast or redirect remains on edit page.
5) **Drag/drop or insert via builder (future enhancement)**
   - From the builder (once snippet insertion UI is wired), ensure snippet can be added to document or preview; not yet implemented—open gap.
6) **Export / download**
   - Use Copy and Download actions (document page or builder) to obtain markdown.
   - Save the downloaded file; read contents and assert it contains updated body plus snippet text, valid UTF-8, `.md` extension.
7) **Verify rendering**
   - Optionally hit `/files/{slug}` or public document view to ensure rendered markdown shows the combined content.

## Assertions (per step)
- Auth completes; avatar or username visible.
- Snippet POST returns 200 and slug/id captured for reuse.
- Document POST/PUT returns 200; content persisted.
- After save, textarea value matches expected merged markdown (body minus removed text + snippet).
- Downloaded file text equals textarea content; copy action copies same string (compare clipboard if available in context).
- Markdown is lint-clean (remark/markdownlint rules) for the assembled text.

## Gaps / Required Work
- **Document editor insertion UI**: need a way to pull a snippet into the document (drag from library or "Insert snippet" action). Currently manual paste.
- **Download endpoint under test**: ensure documents expose a download button and Playwright can capture the file path.
- **Clipboard vs file parity**: add a helper to compare clipboard copy with downloaded file contents.
- **Auth shortcut**: rely on storage state to skip live OAuth; needs fixtures checked into `__tests__/e2e/fixtures` (pending credentials).
- **Markdown lint hook**: create a small util to run remark/markdownlint on the assembled string inside the test to fail fast on malformed markdown.

## Automation Plan (Playwright)
- Location: `__tests__/e2e/FirstTimeUserFlow.test.ts` (new).
- Use `test.skip` when `E2E_STORAGE_STATE` missing.
- Fixtures: context with `acceptDownloads: true`, storage state injected, baseURL from env.
- Steps mirror the narrative; helper functions for createSnippet, createDocument, insertSnippet, downloadAndRead.
- Validate file content with simple remark parse or regex to ensure headings preserved.

## Exit Criteria
- Playwright test passes headless against dev/staging with storage state.
- Downloaded markdown matches textarea content and includes snippet text.
- Lint check passes on generated markdown.
- Gaps above either implemented or tracked in child tasks (p8n.2, p8n.3, p8n.4).
