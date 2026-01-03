# Header + Wordmark QA Checklist
Date: 2025-12-18
Owner: markdowntown-uhi7

## Scope
This checklist covers the global header (desktop + mobile) and the `Wordmark`/branding changes.

## Breakpoints & layout
- Desktop (1280×720): header height stable; no wrapping/clipping in the right-side control cluster.
- Tablet (768×1024): header controls remain usable; no overlap.
- Mobile (390×844): bottom nav hit targets feel consistent; header icons don’t collide.
- Safe-area: iOS notch + bottom inset (if available) — mobile sheets and bottom nav don’t clip content.

## Keyboard & focus
- Tab order is sensible through the header, and focus rings are visible.
- Mobile search sheet:
  - Open via Search button (top icon and bottom nav).
  - Close with Escape and with the Close button.
  - Focus returns to the original trigger.
- Overflow menu sheet:
  - Open via the menu button.
  - Close with Escape and with the Close button.
  - Focus returns to the original trigger.
- Sheet transitions:
  - From overflow sheet, open Search; focus lands in the Search input (no focus bounce).
  - Opening Command palette from a sheet doesn’t restore focus back to the trigger.

## Screen reader / semantics
- Wordmark link has accessible name “mark downtown”.
- Wordmark SVG has `role="img"` with accessible name “mark downtown”.
- BrandLogo icon uses alt text “mark downtown logo”.
- Mobile sheet titles are present (sr-only is fine).

## Theme & contrast
- Light mode: wordmark reads as a nighttime cityscape (theme-inverted).
- Dark mode: wordmark reads as a lit cityscape (theme-inverted).
- No obvious low-contrast elements in header controls (buttons/links/icons).

## Motion
- With `prefers-reduced-motion: reduce`, the wordmark renders static (no twinkle/shimmer).
- Optional safety switch: set `NEXT_PUBLIC_WORDMARK_ANIM_V1=false` to disable wordmark motion entirely.

## Visual regression (Playwright)
1. Build and start the app (recommended):
   - `SKIP_DB=1 NEXT_PUBLIC_WORDMARK_ANIM_V1=false NEXTAUTH_SECRET=visual-secret NEXTAUTH_URL=http://localhost:3000 GITHUB_CLIENT_ID=visual-placeholder GITHUB_CLIENT_SECRET=visual-placeholder pnpm build`
   - `SKIP_DB=1 NEXT_PUBLIC_WORDMARK_ANIM_V1=false NEXTAUTH_SECRET=visual-secret NEXTAUTH_URL=http://localhost:3000 GITHUB_CLIENT_ID=visual-placeholder GITHUB_CLIENT_SECRET=visual-placeholder pnpm start --hostname 0.0.0.0 --port 3000`
2. Update snapshots:
   - `pnpm exec playwright test --config=playwright-visual.config.ts --update-snapshots`
3. Verify:
   - `pnpm test:visual`
4. Linux snapshots (to match CI) can be updated from macOS via the Playwright Docker image:
   - `docker run --rm --ipc=host -v "$PWD":/work -v markdowntown_node_modules_linux:/work/node_modules -v markdowntown_pnpm_store_linux:/work/.pnpm-store -w /work -e BASE_URL="http://host.docker.internal:3000" mcr.microsoft.com/playwright:v1.57.0-noble bash -lc "corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm config set store-dir /work/.pnpm-store && pnpm install --frozen-lockfile && pnpm exec playwright test --config=playwright-visual.config.ts --update-snapshots"`
