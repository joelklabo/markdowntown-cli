# Design System Adoption Playbook (mark downtown 2025)

Audience: engineers/designers adopting the refreshed MDT design system in existing or new surfaces.

## Principles
- Ship tokens first, then primitives, then patterns; avoid bespoke styles.
- Prefer semantic Tailwind classes (`bg-mdt-surface`) over raw values.
- Keep light/dark parity; no component ships without both states.

## Checklist (per feature or page)
1) **Audit**: List all colors, shadows, radii, and spacings in the feature. Replace literals with `mdt-*` tokens.
2) **Wrap with providers**: Ensure `ThemeProvider` is present for light/dark toggling.
3) **Swap primitives**: Replace ad-hoc buttons/inputs/cards with `Button`, `IconButton`, `Input`, `Select`, `Checkbox`, `Radio`, `Card`, `Badge`, `Pill`, `Tag`, `Tooltip`, `Tabs`, `Drawer`, `Pagination`, `Avatar`.
4) **Layout**: Use token spacing scale (`mdt-4`, `mdt-6`, `mdt-8`) and radii (`rounded-mdt-md`).
5) **States**: Add hover/focus/pressed/disabled; ring uses `mdt-ring`; motion uses `duration-mdt-*` and `ease-mdt-*`.
6) **Accessibility**: Check contrast with tokens, verify focus order, and ARIA on nav/search/forms.
7) **Dark mode**: Verify in Storybook toolbar (light/dark) or by toggling the theme in-app.
8) **Docs + stories**: Add or update a Storybook story for new patterns; include any new compound components.
9) **Tests**: Add interaction smoke (Playwright or RTL) for critical controls; include visual baseline when layout shifts.
10) **Changelog**: Note user-facing UI changes and migration steps if apps are consuming shared components.

## Migration steps for legacy code
- Replace deprecated classes: `bg-white`, `bg-gray-*`, `text-slate-*`, `shadow-*` → use semantic tokens.
- Remove inline hex values; `pnpm lint:hex` will fail builds.
- Consolidate one-off button styles into `Button` variants; add a new variant only after design review.
- Use `Card` + `Badge/Pill/Tag` for list and gallery items; avoid repeated bespoke wrappers.
- Normalize focus: drop outline resets; use component-level focus-visible styles.
- Clean motion: replace ad-hoc transitions with `duration-mdt-*` + `ease-mdt-*`; respect `prefers-reduced-motion`.

## Storybook usage
- Run `pnpm storybook` to preview tokens, primitives, and light/dark modes.
- Add stories under `src/stories/` following existing examples (Controls + MDX notes).

## Governance
- New tokens require: name, role, light/dark values, use cases, contrast note.
- New component variants require: design approval + Storybook story + usage guidance.
- Regression guard: visual snapshots for modified layouts; hex lint + ESLint in CI.
