# Motion + Responsive Spec (UI Refresh)

Date: 2025-12-20
Owner: Design/Frontend
Scope: Global shell, cards, forms, navigation, tables, builder/workbench, atlas/simulator, docs

## Goals
- Establish consistent motion tiers and defaults that feel calm and precise.
- Define responsive layout rules that keep every primary flow usable on mobile.
- Ensure reduced-motion users get equivalent clarity without animation reliance.

## Motion Principles
- **Purposeful only:** motion should clarify state changes or direct attention, not decorate.
- **Short + crisp:** default durations are short; avoid long easing for micro-interactions.
- **No layout shift:** motion should never cause layout jumps or content reflow.
- **Accessible by default:** focus states and state changes are obvious even without motion.

## Motion Tokens
Use semantic tokens defined in `src/app/globals.css` and exposed in Tailwind.

### Durations
- `--mdt-motion-fast`: micro interactions (hover, press, tooltip)
- `--mdt-motion-base`: component state changes (card expand, tab switch)
- `--mdt-motion-slow`: panels/sheets and larger transitions

### Easings
- `--mdt-ease-standard`: most UI changes
- `--mdt-ease-emphasized`: emphasized transitions (modals, drawers)

### Distance
- `--mdt-motion-distance-short`: subtle lifts
- `--mdt-motion-distance-mid`: cards/menus
- `--mdt-motion-distance-far`: panels/sheets

## Motion Tiers
- **Micro**: buttons, chips, icon toggles (fast + short distance)
- **Component**: cards, menus, tooltips (base + short/mid distance)
- **Panel/Page**: drawers, sheets, page-level reveals (slow + far distance)

## Motion Patterns
- **Hover/press (buttons, cards):** translateY(-1px) + shadow increase, fast duration.
- **Menu/tooltips:** fade + 4-6px translate with base duration.
- **Tabs:** no sliding content; use opacity/underline transitions only.
- **Panels/sheets:** slide with emphasized easing; avoid opacity-only if it obscures state change.
- **Skeletons/loading:** soft pulse or opacity fade; avoid aggressive movement.

## Reduced Motion
- Respect `prefers-reduced-motion: reduce`.
- Disable translate/scale/continuous animations; keep instant state change + focus ring.
- Ensure state changes are still visible via color/weight/border changes.

## Responsive Layout Rules
### Breakpoints
- Mobile: < 768px
- Tablet: 768px–1023px
- Desktop: >= 1024px
- Wide: >= 1440px

### Containers
- Standard content width: use `Container` sizes (sm/md/lg) rather than raw widths.
- Maintain max line length ~70–80 characters for long-form text.
- Prefer vertical stacking on mobile; avoid two-column layouts below 768px.

### Spacing System
- Use `mdt` spacing scale (e.g., `p-mdt-4`, `gap-mdt-3`).
- Primary page sections: `py-mdt-10 md:py-mdt-12`.
- Cards: default `p-mdt-5` with `space-y-mdt-3` inside.

### Touch Targets
- Minimum target size: 24px for dense UI, 44px preferred for primary actions.
- Ensure at least 8px spacing between adjacent interactive elements.

## Component Guidance
### Navigation
- Desktop: keep active states visible; hover and focus distinct.
- Mobile: collapse into a single row + overflow; avoid multiple competing actions.

### Cards
- Title is primary; actions secondary and aligned consistently (top-right or footer row).
- Maintain equal padding across card types and lists.

### Forms
- Group related inputs with a section heading and short helper text.
- Keep form actions aligned on a single row on desktop, stacked on mobile.

### Tables/Lists
- For dense lists, use clear row separation and consider zebra backgrounds.
- On mobile, collapse to stacked rows with label/value pairs.

### Builder/Workbench
- Make primary actions sticky or always visible.
- Avoid horizontal scroll on mobile; stack panels in a single column.

### Atlas/Simulator
- Input section should be visually distinct from results (background or border).
- Use collapsible sections for long output on mobile.

## QA Checklist
- Reduced-motion pass (no translate/scale, focus visible).
- Mobile pass at 360px width (no overflow).
- Contrast/focus visibility in light + dark.
- LCP/CLS sanity check after layout changes.

## Implementation Notes
- Tokens live in `src/app/globals.css` and flow into Tailwind utilities.
- Prefer `duration-mdt-fast|base|slow` and `ease-mdt-standard|emphasized` in classes.
- Avoid ad hoc animation values in components; use tokens or CSS variables.

