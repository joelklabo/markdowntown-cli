# Motion presets (Dec 2025)

## Tiers
- **Micro**: subtle UI affordances (buttons, chips); duration `mdt-motion-fast`, distance `mdt-motion-distance-short`.
- **Component**: cards, drawers, modals; duration `mdt-motion-base`, distance `mdt-motion-distance-mid`.
- **Panel/Page**: sheets, overlays, page-level transitions; duration `mdt-motion-slow`, distance `mdt-motion-distance-far`.

## Easing
- Default: `ease-mdt-emphasized` (cubic-bezier(0.16, 1, 0.3, 1)).
- Standard: `ease-mdt-standard` for less pronounced moves.
- Respect `prefers-reduced-motion`: avoid translate/opacity; fall back to instant state change.

## Implementation
- Tokens defined in `src/app/globals.css`: durations, easings, distance scales.
- Hook `useMotionPreset(tier, axis)` returns `{ duration, easing, translate }` for consistent CSS-in-JS or inline styles.
- Apply to components with Tailwind `duration-mdt-*` + custom `style` translate or via CSS keyframes.

## Patterns to cover
- Hero/module reveals (panel tier, up/down translation, staggered).
- Drawer/sheet slide (panel tier, x-axis).
- Tooltip/menu pop (micro tier, y-axis).
- Card hover lift (micro tier, small translate + shadow-mdt-md).
- Skeleton/placeholder fade (standard easing, base duration).
- Reduced motion: if `prefers-reduced-motion: reduce`, skip transforms; keep focus rings visible.

## QA
- Verify in Storybook with reduced-motion emulation.
- Check LCP-sensitive areas (hero) keep transform distances minimal and avoid layout shift.
