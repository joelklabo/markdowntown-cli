# Living City Wordmark Legend Spec

## Objective
Provide a clear, minimal legend that explains how the wordmark reacts to site activity without distracting from the UI.

## Legend Items (Copy + Mapping)
- **Dog** — someone uploaded something
- **Pedestrian** — someone signed in
- **Car** — someone is browsing
- **Truck** — template export or bulk action
- **Ambulance** — system alert or incident
- **Window flicker** — search activity
- **Streetlight ripple** — command palette opened

## Placement Guidance
- **Labs (city-logo):** Show legend as a small card below the controls grid.
- **Header:** Optional. If shown, place as a compact tooltip or popover near the wordmark band.

## Visual Styling
- Keep legend neutral and professional.
- Use semantic tokens for text and borders; avoid bright novelty colors.
- Use small pixel icons or simplified glyphs that match the voxel style.

## Accessibility
- Legend text must be readable at 12–14px with sufficient contrast.
- Icons should have `aria-hidden` and the text should remain primary.

## Default Order
1. Dog
2. Pedestrian
3. Car
4. Truck
5. Ambulance
6. Window flicker
7. Streetlight ripple
