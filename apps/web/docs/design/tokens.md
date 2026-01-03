# Option A · Focus / Flow design tokens

Single source of truth for the refreshed UI. Tokens live as CSS custom properties in `src/app/globals.css` and are mapped into Tailwind via `tailwind.config.ts`.

## Palette
- **Primary**: cool cyan (`--mdt-color-primary`, `--mdt-color-primary-strong`, `--mdt-color-primary-soft`) for CTAs and focus.
- **Accent**: warm amber (`--mdt-color-accent`, `--mdt-color-accent-soft`) for highlights and secondary emphasis.
- **Surfaces**: `--mdt-color-bg`, `--mdt-color-surface`, `--mdt-color-surface-subtle`, `--mdt-color-surface-strong`, `--mdt-color-surface-raised`.
- **Lines + text**: `--mdt-color-border`, `--mdt-color-border-strong`, `--mdt-color-text`, `--mdt-color-text-muted`, `--mdt-color-text-subtle`, `--mdt-color-text-on-strong`.
- **Status support**: `--mdt-color-success`, `--mdt-color-warning`, `--mdt-color-danger`, `--mdt-color-info` (+ soft variants).

Dark palette is the default; `.dark` applies it, while the root (no class) holds the light variant.

## Typography
- Display: `var(--font-display)` (Space Grotesk)
- Body: `var(--font-inter)` (Inter)
- Mono: `var(--font-mono)` (JetBrains Mono)

## Radius & shadow
- Radius tokens: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`
- Shadows: `--mdt-shadow-sm`, `--mdt-shadow-md`, `--mdt-shadow-glow`

## Preview
A quick audit view lives at `/tokens`, showing colors, shadows, and radii pulled directly from CSS variables.

## Usage checklist
- Use semantic Tailwind tokens (`bg-mdt-surface`, `text-mdt-text`, `border-mdt-border`, `shadow-mdt-md`) instead of hex values.
- Prefer `font-display` for headings, `font-sans` for body, `font-mono` for code/meta.
- Keep motion subtle: 120–180ms ease (`ease-mdt-emphasized`), small lifts (`hover:-translate-y-[1px]`), and glow shadow for focus/primary buttons.
- Dark is the default theme (`.dark` on html); root contains light palette for future toggle.
