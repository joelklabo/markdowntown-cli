# Motion Guidelines

Date: 2025-12-26
Scope: UI polish sprint motion, microinteractions, and reduced-motion behavior.

## Principles
- Motion explains state change, never decorates without purpose.
- Keep motion short and subtle; avoid large jumps or parallax on core flows.
- Use consistent easing and durations so the app feels cohesive.
- Respect prefers-reduced-motion everywhere (no autoplaying motion for reduced users).

## Timing + easing
- Quick feedback (hover/press/focus): 120-180ms, ease-out.
- Standard UI transitions (panel open, tooltip, dropdown): 180-240ms, ease-out.
- Large layout shifts (page-level section intro): 240-320ms, ease-out.
- Avoid chained animations > 450ms total.

Suggested CSS easing (approx):
- Standard: cubic-bezier(0.2, 0.8, 0.2, 1)
- Snappy: cubic-bezier(0.16, 1, 0.3, 1)
- Linear only for progress indicators.

## Motion tokens (naming)
- motion-fast: 120ms
- motion-base: 180ms
- motion-slow: 240ms
- motion-layout: 300ms

## Reduced motion
- If prefers-reduced-motion is set:
  - Disable continuous animations (wordmark, ambient background).
  - Replace slides with fades or instant state changes.
  - Keep focus/hover feedback but remove transforms.

## Component guidance
- Buttons / IconButton: scale or shadow lift max 1-2px; 120-160ms.
- Cards / surfaces: subtle shadow + translateY 1-2px on hover; 180ms.
- Tabs: underline/indicator moves with 180ms ease-out.
- Sheets / drawers: fade + translateY 6-12px; 220-280ms.
- Tooltip / Popover: fade + scale 0.98 -> 1.0; 120-160ms.
- Nav indicator: short underline slide (<= 180ms).
- Wordmark: keep ambient motion low amplitude and < 2s loops; provide static fallback.
- Wordmark banner: animation must never change layout size; banner height stays fixed.

## Page-level guidance
- Home hero: one entrance animation (opacity + 8px translate) on load.
- Atlas Simulator: results panel can fade in after scan; avoid long sequences.
- Workbench: avoid auto-animating panel swaps; use instant or subtle fades only.

## Implementation notes
- Favor CSS transitions over JS-driven animation for simple UI state.
- Use `prefers-reduced-motion` media queries to gate keyframes and transitions.
- Keep animations out of critical render paths (no layout thrashing).
- Wordmark animation should be isolated to SVG internals; never adjust container height or padding.

## QA checklist
- Verify reduced-motion disables wordmark animation and section entrance motion.
- Confirm hover/focus transitions are consistent across buttons and cards.
- Ensure tooltips and sheets appear fast and do not cause layout shifts.
- Validate that motion does not obscure or delay important feedback.
