# Accessibility UI Review Checklist
Date: 2025-12-20
Owner: markdowntown-t0ef

## Scope
- Header + Living City wordmark band
- Navigation (desktop + mobile)
- Tabs/pickers (detail pages, workbench, filters)
- Forms, buttons, and critical CTAs

## Checklist
### Contrast
- Text contrast meets WCAG AA (4.5:1 for body, 3:1 for large text).
- Muted text is still readable on `mdt-surface` and `mdt-surface-subtle`.
- Active/hover states remain distinct in light/dark modes.

### Focus + Keyboard
- All interactive elements are reachable via keyboard and have visible focus rings.
- Focus order is logical across header, main content, and modals.
- Modals trap focus and restore focus to the triggering element on close.

### Tabs + Pickers
- Tabs use proper roles (`tablist`, `tab`, `tabpanel`) and `aria-selected`.
- Arrow keys move between tabs; `Tab` moves into panel content.
- Active tab is visually distinct without relying on color alone.

### Target Size
- Touch targets meet 44x44px or equivalent perceived size.
- Icon-only controls have accessible labels (`aria-label`).

### Motion + Reduced Motion
- Motion is reduced or disabled when `prefers-reduced-motion` is enabled.
- Animated header elements do not flash or strobe.

## Findings
- None logged yet. Add issues as needed.
