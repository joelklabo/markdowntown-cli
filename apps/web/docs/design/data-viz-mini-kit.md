# Data Viz Mini-Kit (Dec 2025)

## Components
- `Sparkline`: lightweight trend line using CSS vars; accepts `points` array.
- `MiniBars`: tiny bar group for counts/distribution.
- `MiniDonut`: completion percentage badge with stroke animation potential.

## Tokens
- Use `mdt-primary` / `mdt-primary-soft` for fills; text uses semantic tokens.
- Shadows optional; keep to micro tier motion if animated.

## Usage patterns
- Stats strip on snippet/template pages (views/copies/votes).
- Builder status card (autosave % complete).
- Browse cards: tiny sparkline for recent copies/views.

## A11y
- `role="img"` + `aria-label` on charts; text percent visible on donuts.
- Respect reduced motion: disable stroke-dash animations; keep static fill.

## Future
- Add stacked mini-bars, comparison badges, delta arrows with tokenized colors.
