# Palette Refresh 2025 · Direction + Token Map

Date: 2025-12-28
Owner: Design
Goal: Refresh the semantic color system to feel premium, calm, and confident while staying aligned with the Living City wordmark.

## Design intent
- **Crisp, calm base**: cooler neutrals with soft contrast for surfaces.
- **Electric clarity**: a cool cyan primary for focus/CTA emphasis.
- **Warm accent**: a controlled amber accent for highlights and attention without overwhelming the UI.
- **Status clarity**: success/warn/danger/info stay distinct and readable in both themes.

## Semantic roles + usage
- **Primary**: primary CTA, active states, focus emphasis.
- **Primary strong**: hover/active for primary CTA, ring emphasis.
- **Primary soft**: subtle fills (pills, chips, highlights).
- **Accent**: secondary emphasis (badges, highlights, accent borders).
- **Accent soft**: subtle accent fills.
- **Surfaces**: layered panels (bg, surface, surface-subtle, surface-strong, surface-raised).
- **Borders**: low-contrast dividers + stronger emphasis for active edges.
- **Text**: base, muted, subtle, on-strong (reversed).

## Light palette targets (HSL)
- **Base neutrals**: cool blue-gray hue (220–222), low saturation.
- **Primary (cyan)**: hue 195–200, sat 75–90, lightness 50–62.
- **Accent (amber)**: hue 38–42, sat 90–96, lightness 50–62.
- **Success**: hue 150–160, sat 60–75, lightness 45–55.
- **Warning**: hue 32–40, sat 85–95, lightness 50–60.
- **Danger**: hue 345–355, sat 70–85, lightness 50–58.
- **Info**: hue 200–210, sat 80–92, lightness 50–60.
- **Text**: near-black blue-gray (hsl 222 50% 9%).
- **Borders**: low-contrast blue-gray (hsl 220 16% 84%).

## Dark palette targets (HSL)
- **Base neutrals**: cool charcoal (220–222), low saturation.
- **Primary (cyan)**: hue 195–200, sat 80–90, lightness 60–72.
- **Accent (amber)**: hue 38–42, sat 95–98, lightness 60–70.
- **Success**: hue 150–160, sat 60–75, lightness 55–65.
- **Warning**: hue 32–40, sat 85–95, lightness 58–68.
- **Danger**: hue 345–355, sat 70–85, lightness 58–68.
- **Info**: hue 200–210, sat 80–92, lightness 58–68.
- **Text**: near-white blue-gray (hsl 220 33% 92%).
- **Borders**: low-contrast charcoal (hsl 220 18% 30%).

## Contrast targets
- **Body text on surface**: >= 4.5:1.
- **Muted text on surface**: >= 3.0:1.
- **Primary CTA text on primary**: >= 4.5:1.
- **Focus ring vs surface**: >= 3.0:1.

## Neutral scale targets (HSL)
Light targets align with `globals.css` defaults:
- `bg`: hsl(220 28% 98%)
- `surface`: hsl(220 30% 99%)
- `surface-subtle`: hsl(220 24% 96%)
- `surface-strong`: hsl(220 20% 92%)
- `surface-raised`: hsl(220 30% 99%)
- `border`: hsl(220 16% 84%)
- `border-strong`: hsl(220 14% 76%)
- `ring`: hsl(196 88% 54% / 0.45)
- `primary-soft`: hsl(196 92% 94%)
- `accent-soft`: hsl(40 94% 92%)

Dark targets align with `globals.css` defaults:
- `bg`: hsl(220 20% 7%)
- `surface`: hsl(220 18% 9%)
- `surface-subtle`: hsl(220 16% 12%)
- `surface-strong`: hsl(220 16% 16%)
- `surface-raised`: hsl(220 18% 14%)
- `border`: hsl(220 18% 30%)
- `border-strong`: hsl(220 18% 38%)
- `ring`: hsl(196 90% 66% / 0.4)
- `primary-soft`: hsl(196 80% 20% / 0.6)
- `accent-soft`: hsl(40 90% 26% / 0.6)

## Wordmark + header alignment
- Wordmark skyline should remain readable in both themes with **>= 3:1** contrast.
- Use the primary cyan as a subtle glow anchor, not a full background.
- Keep the header as the most saturated surface; UI surfaces should feel calmer.

## Token mapping checklist
- Update `--mdt-color-primary`, `--mdt-color-primary-strong`, `--mdt-color-primary-soft`.
- Update `--mdt-color-accent`, `--mdt-color-accent-soft`.
- Update `--mdt-color-success|warning|danger|info` and soft counterparts.
- Update `--mdt-color-bg`, `--mdt-color-surface*`, `--mdt-color-border*`, `--mdt-color-text*`, `--mdt-color-ring`.
- Update data-viz palette tokens to match primary/accent hues.
