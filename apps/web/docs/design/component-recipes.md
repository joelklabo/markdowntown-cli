# Component Recipes + States (2025)

Date: 2025-12-29
Owner: Design
Goal: Define how core components use semantic tokens and interact across light/dark themes.

## Principles
- Use semantic tokens only (no raw hex values).
- Emphasize a single primary CTA per surface.
- Keep focus states legible on both surface and raised panels (>= 3.0:1 contrast).
- Disabled states remain readable while clearly non-interactive.

## Buttons

| Variant | Default | Hover | Active | Focus | Disabled | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Primary | `bg-mdt-primary text-mdt-text-on-strong` | `bg-mdt-primary-strong` | `bg-mdt-primary-strong` + `shadow-mdt-btn-hover` | `ring-mdt` + `ring-offset-mdt` | `bg-mdt-primary-soft text-mdt-text-muted` | Use for the single primary CTA. |
| Secondary | `bg-mdt-surface text-mdt-text border-mdt-border` | `bg-mdt-surface-strong` | `bg-mdt-surface-strong` | `ring-mdt` | `bg-mdt-surface-subtle text-mdt-text-muted` | Preferred for supporting actions. |
| Ghost | `bg-transparent text-mdt-text` | `bg-mdt-surface-subtle` | `bg-mdt-surface-strong` | `ring-mdt` | `text-mdt-text-muted` | Use for tertiary actions. |
| Destructive | `bg-mdt-danger text-mdt-text-on-strong` | `bg-mdt-danger-strong` | `bg-mdt-danger-strong` | `ring-mdt` | `bg-mdt-danger-soft text-mdt-text-muted` | Avoid multiple destructive CTAs in one view. |

## Cards

| Type | Default | Hover | Active | Focus | Notes |
| --- | --- | --- | --- | --- | --- |
| Standard | `bg-mdt-surface border-mdt-border shadow-mdt-sm` | `shadow-mdt-md` | `shadow-mdt-md` | `ring-mdt` | Primary container for sections. |
| Subtle | `bg-mdt-surface-subtle border-mdt-border` | `bg-mdt-surface` | `bg-mdt-surface` | `ring-mdt` | Use for grouped sections. |
| Emphasis | `bg-mdt-surface-strong border-mdt-border-strong` | `shadow-mdt-md` | `shadow-mdt-md` | `ring-mdt` | Use sparingly for highlights. |

## Pills / Badges / Tags

| Component | Default | Hover | Focus | Disabled | Notes |
| --- | --- | --- | --- | --- | --- |
| Pill | `bg-mdt-primary-soft text-mdt-text` | `bg-mdt-primary-soft` | `ring-mdt` | `bg-mdt-surface-subtle text-mdt-text-muted` | Use for small status or metadata. |
| Badge | `bg-mdt-accent-soft text-mdt-text` | `bg-mdt-accent-soft` | `ring-mdt` | `bg-mdt-surface-subtle text-mdt-text-muted` | Keep badge size compact. |
| Tag | `bg-mdt-surface-subtle text-mdt-text border-mdt-border` | `bg-mdt-surface` | `ring-mdt` | `bg-mdt-surface-subtle text-mdt-text-muted` | Tags should use neutral surfaces. |

## Tabs

| State | Style | Notes |
| --- | --- | --- |
| Default | `text-mdt-text-muted` + bottom border transparent | Tabs should align with nav underline style. |
| Hover | `text-mdt-text` + `border-mdt-border-strong` | Increase hit target to >= 44px height on mobile. |
| Active | `text-mdt-text` + `border-mdt-primary` | Single active indicator style across nav + tabs. |
| Focus | `ring-mdt` | Ensure keyboard focus visible. |
| Disabled | `text-mdt-text-muted` | Avoid disabled tabs unless necessary. |

## Inputs

| Type | Default | Hover | Focus | Disabled | Notes |
| --- | --- | --- | --- | --- | --- |
| Text input | `bg-mdt-surface border-mdt-border text-mdt-text` | `border-mdt-border-strong` | `ring-mdt border-mdt-primary` | `bg-mdt-surface-subtle text-mdt-text-muted` | Use consistent height with buttons. |
| Select | `bg-mdt-surface border-mdt-border` | `border-mdt-border-strong` | `ring-mdt` | `bg-mdt-surface-subtle text-mdt-text-muted` | Keep chevron subtle. |
| Textarea | `bg-mdt-surface border-mdt-border` | `border-mdt-border-strong` | `ring-mdt` | `bg-mdt-surface-subtle text-mdt-text-muted` | Match input padding. |

## Spacing + hierarchy
- Use `mdt-4` to `mdt-6` gaps between stacked components.
- Align component baselines in rows (buttons + inputs share height).
- Prefer a single primary CTA per card; secondary actions align right or below.

## References
- Palette direction: `docs/design/palette-refresh.md`
- Token map: `docs/design/palette-token-map.md`
- Design system tokens: `docs/DESIGN_SYSTEM.md`
