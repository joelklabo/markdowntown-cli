# Markdowntown Design System

Last updated: Jan 4, 2026

## Principles
- **Semantic first:** use intent-based tokens (`mdt-surface`, `mdt-text-muted`, `mdt-primary`) instead of hard-coded hex.
- **Light & dark parity:** all tokens swap via CSS variables; components never hard-code colors.
- **Consistent rhythm:** spacing, radius, and shadow ladders follow a 4px-derived scale.
- **Composable primitives:** buttons, cards, pills, and tabs should compose without bespoke styling.

## Tokens
### Colors (semantic)
Defined in `apps/web/src/app/globals.css`, exposed via Tailwind as `mdt-*`.

- Brand: `mdt-primary`, `mdt-primary-strong`, `mdt-primary-soft`, `mdt-accent`, `mdt-accent-soft`
- Status: `mdt-success`, `mdt-warning`, `mdt-danger`, `mdt-info`
- Surfaces: `mdt-bg`, `mdt-surface`, `mdt-surface-subtle`, `mdt-surface-strong`, `mdt-surface-raised`, `mdt-overlay`
- Lines: `mdt-border`, `mdt-border-strong`, `mdt-ring`
- Text: `mdt-text`, `mdt-text-muted`, `mdt-text-subtle`, `mdt-text-on-strong`

### Typography
- Fonts: `font-sans`, `font-display`, `font-mono` via CSS vars.
- Scale keys: `display`, `h1`, `h2`, `h3`, `body`, `body-sm`, `caption`.

### Spacing, Radius, Shadows
- Spacing tokens: `mdt-1,2,3,4,5,6,8,10,12` (4/8 base).
- Radii: `mdt-sm`, `mdt-md`, `mdt-lg`, `mdt-pill`.
- Shadows: `mdt-sm`, `mdt-md`, `mdt-lg`, `mdt-focus`, `mdt-btn`, `mdt-btn-hover`.

### Motion
- Durations: `duration-mdt-fast|base|slow`.
- Easing: `ease-mdt-standard|mdt-emphasized|mdt-snappy`.
- Reduced motion: honor `prefers-reduced-motion` by clamping durations.

## Theming
- Dark mode uses the `dark` class on `html` (managed by `apps/web/src/providers/ThemeProvider.tsx`).
- Tokens are CSS variables; Tailwind maps to these vars so components stay semantic.

## Primitives
- Buttons, cards, pills, tabs, inputs, and status components live under `apps/web/src/components` and `apps/web/src/components/ui`.
- Use `apps/web/src/lib/cn.ts` for class composition.

## Conventions
- Prefer semantic tokens (`bg-mdt-surface`, `text-mdt-text`) over literal values.
- No raw hex in components; `pnpm -C apps/web lint:hex` enforces this.
- Keep shared UI under `apps/web/src/components/ui/`.

## References
- Tokens: `apps/web/src/app/globals.css`
- Tailwind bridge: `apps/web/tailwind.config.ts`
- Theme toggle: `apps/web/src/components/ThemeToggle.tsx`
- Palette refresh: `apps/web/docs/design/palette-refresh.md`
- Token map: `apps/web/docs/design/palette-token-map.md`
