# Component Polish Inventory (2025)

Date: 2025-12-28
Owner: Codex
Scope: Buttons, Inputs, Pills, Badges, Cards, Tabs, Tooltips, Nav, Panels, Lists

## Inventory (current vs desired)

### Buttons (primary, secondary, ghost)
- Current: Multiple variants with consistent spacing; hover/active states vary across surfaces.
- Gaps: Focus/active states are not always visually distinct in dark mode; secondary button borders can appear flat.
- Desired: Clear default/hover/active/focus/disabled cadence across all variants with tokenized borders + shadows.
- References: `src/components/ui/Button.tsx`, `docs/design/palette-refresh.md`

### Inputs + TextArea
- Current: Clear base styles, but focus ring weight varies by surface.
- Gaps: Subtle input states can feel low-contrast in dark mode; disabled styling is inconsistent.
- Desired: Unified focus ring + border strength, consistent disabled contrast, and clearer error state contrast.
- References: `src/components/ui/Input.tsx`, `src/components/ui/TextArea.tsx`

### Pills + Badges
- Current: Tokens present but usage is mixed (muted vs info vs success).
- Gaps: Hover/active states are not defined; dense usage makes spacing feel tight.
- Desired: Define pill and badge interaction states and spacing rules, align tones with palette refresh.
- References: `src/components/ui/Pill.tsx`, `src/components/ui/Badge.tsx`

### Cards + Surfaces
- Current: Multiple card tones; elevation varies across surfaces.
- Gaps: Shadow levels not consistently tied to action/state; borders sometimes inconsistent.
- Desired: Establish card elevation tiers and hover treatments for interactive cards.
- References: `src/components/ui/Card.tsx`, `src/components/ui/Surface.tsx`

### Tabs + Segmented controls
- Current: Clean base styles; active indicator changes per surface.
- Gaps: Active/hover backgrounds vary; focus ring not always obvious.
- Desired: Single interaction pattern with clear active state and consistent focus ring.
- References: `src/components/ui/Tabs.tsx`

### Tooltips + Overlays
- Current: Tooltip styling is consistent; overlay padding varies.
- Gaps: Shadow and border colors can drift from palette refresh.
- Desired: Align overlay backgrounds, borders, and shadows with updated tokens.
- References: `src/components/ui/Tooltip.tsx`, `src/components/ui/Sheet.tsx`, `src/components/ui/Drawer.tsx`

### Nav + Footer
- Current: Nav uses strong contrast; footer links flatten on mobile.
- Gaps: Focus states and hover colors can vary between nav and footer.
- Desired: Shared interaction tokens for nav + footer links with clear focus.
- References: `src/components/SiteNav.tsx`, `src/components/Footer.tsx`

### Panels + Lists
- Current: Panel padding differs across Workbench/Atlas/Library.
- Gaps: List row hover and selection states not standardized.
- Desired: Define list row states and standard panel padding tiers.
- References: `src/components/workbench/*`, `src/components/atlas/*`, `src/components/library/*`

## State Matrix (primary components)

### Buttons

| State | Primary | Secondary | Ghost |
| --- | --- | --- | --- |
| Default | Solid fill + strong text | Surface fill + border | Transparent + text |
| Hover | Darken fill + lift shadow | Stronger border + subtle fill | Subtle surface fill |
| Active | Tighten shadow + stronger fill | Surface strong + border | Surface strong |
| Focus | Ring with primary token | Ring with border token | Ring with border token |
| Disabled | Muted text + low-contrast fill | Muted border + text | Muted text |


### Inputs / TextArea

| State | Treatment |
| --- | --- |
| Default | Surface background + subtle border |
| Hover | Border strong |
| Active | Border strong + slight elevation |
| Focus | Ring + strong border |
| Error | Danger border + danger ring |
| Disabled | Subtle background + muted text |


### Cards (interactive)

| State | Treatment |
| --- | --- |
| Default | Subtle border + base shadow |
| Hover | Lifted shadow + border strong |
| Active | Slightly reduced shadow + border strong |
| Focus | Ring + border strong |
| Disabled | Muted surface + no shadow |


### Tabs

| State | Treatment |
| --- | --- |
| Default | Muted text + transparent background |
| Hover | Surface subtle background |
| Active | Primary text + underline/indicator |
| Focus | Ring + border strong |
| Disabled | Muted text |


## Motion + Elevation Alignment
- Prefer short, consistent durations (120-180ms) for hover/active transitions.
- Use elevation tiers: flat (0), card (1), raised (2), overlay (3).
- Hover should never exceed one elevation tier to avoid visual jump.

## Density + Spacing Rules
- Default control height: 40-44px for primary actions, 32-36px for compact controls.
- Maintain 8-12px vertical spacing between stacked controls.
- Use consistent padding for panels: compact (16px), standard (20-24px), spacious (28px).

## Next Steps
1) Audit each component against the state matrix.
2) Map states to updated palette tokens.
3) Validate dark mode and high-contrast readability.
4) Update `docs/design/site-ux-audit.md` with polish priorities.
