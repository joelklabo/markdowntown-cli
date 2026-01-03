# Option A · Focus / Flow design system

## Intent
Quiet, pro-grade UI inspired by focused editors (zed.dev) with crisp slabs, electric cyan accents, and mono display headings. Dark-first; light palette available via CSS vars.

## Tokens
- Defined in `src/app/globals.css` and mapped in `tailwind.config.ts`.
- Palette: primary cyan `--mdt-color-primary`, accent mint, success/warning/danger/info, surface/surface-subtle/surface-strong, border, text/muted.
- Typography: `--font-display` (Space Grotesk) for headings, `--font-inter` for body, `--font-mono` for code/meta.
- Radius: `--radius-sm/md/lg/pill`.
- Shadow: `--mdt-shadow-sm`, `--mdt-shadow-md`, `--mdt-shadow-glow`.
- Motion: base 120–180ms, easing `ease-mdt-emphasized`.

## Primitives
Location: `src/components/ui/*`
- Button: primary/secondary/ghost, pill radius, glow focus ring.
- Input/TextArea: border + soft shadow; focus ring using primary.
- Tabs: Radix-based, pill triggers, surfaced list background.
- Tooltip: Radix, subtle surface with border.
- Drawer: Radix dialog configured as right-side sheet.

## Layout patterns
- Slab cards: `Card` + `shadow-mdt-md` + `hover:shadow-mdt-glow`.
- Hero: two-column grid, command entry, supporting chips.
- Explore: header slab + filters left, results grid responsive.
- Builder: 4-column XL (templates / snippets / preview / outline).

## Accessibility & keyboard
- Focus rings use primary + offset.
- Command palette: ⌘K/Ctrl+K, arrow/Enter/Esc.
- Outline pane: ARIA `tree` + draggable headings.
- Drag from library cards carries JSON payload for builder drop targets.

## Pages that use Option A
- Tokens preview: `/tokens`
- Home & Browse: updated to slab layout.
- Builder: outline, drag/drop, status strip.

## How to extend
- Add new color roles by defining CSS vars + Tailwind aliases.
- When adding components, consume tokens via utility classes (not raw hex).
- Prefer Radix primitives for popovers/modals to keep a11y consistent.
