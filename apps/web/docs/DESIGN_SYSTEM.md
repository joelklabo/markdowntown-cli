# mark downtown design system (2025)

## Tokens
- **Color roles (light/dark via CSS vars):** primary / primary-strong / primary-soft, accent / accent-soft, success, warning, danger, info, bg, surface, surface-subtle, surface-strong, surface-raised, overlay, border, border-strong, ring, text, text-muted, text-subtle, text-on-strong. See `src/app/globals.css`.
- **Palette direction:** cool cyan primary + warm amber accent; documented in `docs/design/palette-refresh.md`.
- **Token map:** semantic role mapping and usage examples in `docs/design/palette-token-map.md`.
- **Contrast targets:** body text >= 4.5:1, muted text >= 3.0:1, focus ring >= 3.0:1 against surfaces (see palette doc).
- **Radii:** `mdt-sm`, `mdt-md`, `mdt-lg`, `mdt-pill`.
- **Shadows:** `mdt-sm`, `mdt-md`, `mdt-lg`, `mdt-focus`, `mdt-btn`, `mdt-btn-hover`.
- **Motion:** `duration-mdt-fast|base|slow`, easing `ease-mdt-standard|mdt-emphasized` (CSS vars).
- **Spacing scale:** `mdt-1,2,3,4,5,6,8,10,12` (4/8 base) for padding/gap/space utilities.
- **Typography:** sizes `display`, `h1`, `h2`, `h3`, `body`, `body-sm`, `caption`; font families `sans`, `display`, `mono` powered by CSS vars.

## Theming
- Dark mode uses the `dark` class on `html` (handled by `ThemeProvider` in `src/providers/ThemeProvider.tsx`).
- All palette values live in CSS variables; Tailwind colors reference the vars so component code never hard-codes hex.
- Focus outline and box shadows use the ring token for consistent emphasis.

## Globals
- Base bg/text + focus ring in `src/app/globals.css`.
- Utility classes: `.btn`, `.btn-primary`, `.btn-secondary`, `.card`, `.pill` variants, `.skip-link`.
- Markdown preview styles consume surface/text tokens for light/dark parity.

## Primitives
- `BrandLogo`, `Wordmark`, `Button` (primary/secondary/ghost, sm/md/lg, `asChild`), `Card`, `Pill`; helper `cn` in `src/lib/cn.ts`.
- Detail kit: `DetailTabs` (rendered/raw toggle + copy), `DetailStats` (views/copies/votes strip), `DetailWarning` (private/unlisted banner), `FeedbackCTA` (feedback prompt).
- Status: `BuilderStatus` shows perf/cache/save state for builder.

## Conventions
- Prefer semantic Tailwind tokens (`bg-mdt-surface`, `text-mdt-text`, `shadow-mdt-md`) over literal values.
- No raw hex colors: enforced by `pnpm lint:hex` (script checks src/docs/scripts for hex literals).
- Keep shared UI under `src/components/ui/`; keep tokens in `tailwind.config.ts` and `globals.css`.

## References
- Tailwind tokens: `tailwind.config.ts`
- Theme + toggle: `src/providers/ThemeProvider.tsx`, `src/components/ThemeToggle.tsx`
- Token source of truth: `src/app/globals.css`
