# Design system (summary)

## Tokens
- CSS custom properties under `.nostrstack-theme` with `--nostrstack-*` prefix.
- Key groups: colors, radius, shadow, motion, spacing.

## Apply themes
- CSS vars on a wrapper selector.
- Helper APIs: `themeToCssVars`, `themeToCss`, `applyNostrstackTheme`, `createNostrstackBrandTheme`.

## Component primitives
- Buttons: `.nostrstack-btn` (+ modifiers)
- Inputs: `.nostrstack-input`, `.nostrstack-textarea`, `.nostrstack-select`
- Surfaces: `.nostrstack-card`
- Primitives: `.nostrstack-badge`, `.nostrstack-callout`

## Motion
- Default 120–180ms; small distances; respect `prefers-reduced-motion`.
