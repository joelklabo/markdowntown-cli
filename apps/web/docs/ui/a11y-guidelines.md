# Accessibility Guidelines

Date: 2025-12-26
Scope: UI polish sprint accessibility expectations and checks.

## Core requirements
- Keyboard navigation must reach all interactive elements.
- Focus must be visible with adequate contrast and offset.
- Inputs must have labels and clear error messaging.
- Target sizes must meet 44x44px minimum for touch.
- Color contrast: 4.5:1 for body text, 3:1 for large text and UI icons.

## Focus + keyboard
- Use `:focus-visible` styles consistently (ring + outline offset).
- Ensure focus order follows visual order.
- Do not trap focus except in modal/sheet; when open, trap + restore.
- All hover-only affordances must have keyboard equivalents.

## Forms
- Every input has a programmatic label (label + htmlFor or aria-label).
- Associate helper/error text via `aria-describedby`.
- Error states must include text, not color alone.
- Disabled vs read-only states must be visually distinct and announced.

## Navigation + landmarks
- Add semantic landmarks: header, nav, main, footer.
- Ensure only one primary h1 per page.
- Breadcrumbs should be in a nav with aria-label.
- Avoid duplicate link names that point to different destinations.

## Content + readability
- Limit line length to ~70-80 characters for long-form text.
- Use sentence case for labels and buttons.
- Provide empty state guidance with next steps.

## Motion + reduced motion
- Respect prefers-reduced-motion for all keyframes.
- Avoid parallax and continuous motion for reduced users.

## Component specifics
- Buttons: clear default, hover, focus, disabled states; no color-only change.
- Icon-only buttons: add aria-label and visible tooltip.
- Toggles: announce state via aria-pressed or role=switch.
- Tabs: implement roving tabindex and aria-controls/aria-selected.
- Tooltips: do not block focus; should be dismissible and accessible.

## Testing checklist
- Keyboard-only traversal on Home, Atlas Simulator, Workbench, Library, Translate.
- Screen reader pass for forms (labels read correctly).
- Verify focus visibility in light and dark modes.
- Run DevTools a11y audit on /atlas/simulator and /workbench.

## Follow-up triggers
- If any element fails target size or label rules, create a follow-up task.
- If any new component is added, include a11y acceptance criteria in its task.
