# mark downtown design system

Last updated: Dec 20, 2025

## Principles
- **Semantic first:** use intent-based tokens (e.g., `mdt-surface`, `mdt-text-muted`, `mdt-primary`) instead of hard-coded hex values. Enables theming and accessibility tweaks without refactoring components.
- **Light & dark parity:** all semantic tokens have light/dark values via CSS variables; no color is hard-coded in components.
- **Consistent rhythm:** spacing and typography follow a 4px-derived scale; radii and shadows ladder consistently.
- **Composable primitives:** buttons, cards, pills use the semantic tokens and can be mixed without bespoke styling.
- **Header harmony:** the Living City wordmark sets the tone; keep nav surfaces and text contrast strong so the header reads cleanly in light/dark.

## Tokens

### Colors (semantic)
Defined as CSS variables in `src/app/globals.css`, exposed in Tailwind as `mdt-*`.

- Brand: `mdt-primary`, `mdt-primary-strong`, `mdt-primary-soft`, `mdt-accent`, `mdt-accent-soft`
- Status: `mdt-success`, `mdt-warning`, `mdt-danger`, `mdt-info`
- Surfaces: `mdt-bg`, `mdt-surface`, `mdt-surface-subtle`, `mdt-surface-strong`, `mdt-surface-raised`, `mdt-overlay`
- Lines: `mdt-border`, `mdt-border-strong`, `mdt-ring`
- Text: `mdt-text`, `mdt-text-muted`, `mdt-text-subtle`, `mdt-text-on-strong`

Legacy aliases (`mdt-blue`, `mdt-bg`, etc.) still map to the semantic set for backward compatibility.

### Typography
- Font: Inter (variable) as `font-sans`.
- Scale (Tailwind keys): `display` 36px, `h1` 30px, `h2` 24px, `h3` 20px, `body` 16px, `body-sm` 14px, `caption` 12px.

### Spacing & Radius
- Density: `--mdt-density-scale` multiplies the 4px scale (`compact` = 0.85, theme refresh = 1.05). Use density toggles to validate rhythm at both ends.
- Spacing: `mdt-0` through `mdt-16` (0,1,2,3,4,5,6,7,8,9,10,11,12,14,16) available via Tailwind (`p-mdt-5`, `gap-mdt-4`, `py-mdt-10`, etc.).
- Radius: `mdt-sm`, `mdt-md`, `mdt-lg`, `mdt-pill`.
- Page rhythm: primary pages use `py-mdt-10 md:py-mdt-12`; primary stacks use `gap={8}` with nested `gap={2|3|4}`; cards default to `p-mdt-5` with `space-y-mdt-3`.

### Elevation & Motion
- Shadows: `mdt-sm`, `mdt-md`, `mdt-lg`, `mdt-focus`, plus button shadows.
- Motion: timings `mdt-fast|base|slow` + `mdt-enter|exit`; easings `ease-mdt-standard`, `ease-mdt-emphasized`, `ease-mdt-snappy`; distances `mdt-motion-distance-{short,mid,far}`.
- Motion utilities: `motion-fade-in`, `motion-slide-up`, `motion-scale-in`, and Radix sheet transitions (`mdt-radix-panel-*`) for staged reveals.
- Reduced motion: `prefers-reduced-motion` clamps animation/transition durations to ~0 and disables wordmark animation. Avoid motion-only affordances.

## Usage in Tailwind
- Backgrounds: `bg-mdt-surface`, `bg-mdt-surface-subtle`.
- Text: `text-mdt-text`, `text-mdt-text-muted`, `text-mdt-primary`.
- Borders: `border-mdt-border`.
- Actions: `bg-mdt-primary`, `hover:bg-mdt-primary-strong`.
- Cards: `bg-mdt-surface shadow-mdt-sm border border-mdt-border`.
- Motion: `duration-mdt-fast`, `duration-mdt-base`, `ease-mdt-standard`, `ease-mdt-snappy`.
- Dark mode: toggle `.dark` on `html` or `body`; tokens swap via CSS variables.

## Components (primitives)
- **Button / IconButton:** variants `primary|secondary|ghost`; sizes `sm|md|lg`; focus ring uses `mdt-ring`. IconButton adds `shape=rounded|pill`.
- **Input / TextArea / Select:** border + surface tokens, ring on focus, placeholder uses muted text.
- **Checkbox / Radio:** accent color bound to `mdt-primary`, rounded shapes, label-friendly.
- **Badge / Pill / Tag:** badges for status; pills for filters; tag supports removable chip via `onRemove`.
- **Tabs:** use the shared tabs component/pill styles; target height ≥ 40px, clear active state, visible focus ring, and consistent spacing.
- **Breadcrumb / Card / Tooltip / Drawer:** surfaces, borders, overlay token for Drawer.
- **Avatar:** image or initials fallback; sizes `sm|md|lg`.
- **Pagination:** previous/next and page buttons styled with surface/primary-soft tokens.
- **Wordmark:** `Wordmark` + `LivingCityWordmark` render the voxel/cityscape banner; keep backgrounds clear for contrast and respect `prefers-reduced-motion`.

## File map
- Tokens: `src/app/globals.css` (`:root` and `.dark` CSS variables).
- Tailwind bridge: `tailwind.config.ts` (`mdt` colors, radius, shadows, motion).
- Components: `src/components/**/*` and `src/components/ui/*` use `mdt-*` tokens; new primitives live in `src/components/ui/`.

## Storybook playground
- Run `pnpm storybook` for the live token + primitives gallery (light/dark toggle in the toolbar).
- Stories live in `src/stories/*`; global config in `.storybook/`.

## Future improvements
- Add a “neutral” gray ramp for data viz.
- Introduce semantic spacing aliases (`space-2`, `space-3`) in components docs.
- Add dark-mode previews in Storybook/Playwright visual baselines.
- Consider a secondary display font for hero headlines if/when brand evolves.
