# Builder Wizard v2 Implementation Plan
Date: 2025-12-01
Issue: markdowntown-t67.3

## Scope
- Multi-step wizard: Template/Blank → Add Snippets → Arrange → Preview → Export.
- Sticky footer controls, progress indicator, keyboard-accessible reorder.
- Live preview from builder render API; Copy/Download; Save as Document (authed) with resume after sign-in.
- Deep links from Use Template / Add to Builder.
- Analytics: step progression, add_to_builder, export, save_document.

## UI Checklist
- [ ] Stepper/progress at top; mobile-friendly.
- [ ] Step 1: template picker + "Start blank"; load user's templates + public spotlight; CTA “Next”.
- [ ] Step 2: snippet library list/search; add/remove; inline tags; favorites tab when authed.
- [ ] Step 3: Arrange list with drag and keyboard (up/down buttons + arrow keys); visibility badges.
- [ ] Step 4: Preview rendered + raw; warnings for private/unlisted; stats summary.
- [ ] Step 5: Export actions (Copy/Download) + Save as Document (authed) + deep link back.
- [ ] Sticky footer with Back/Next/Finish, disabled state until requirements met.
- [ ] Sticky bottom bar on mobile; avoid overlap with mobile nav.

## Data / API
- Input state: templateId, templateFields, snippets[], overrides, order.
- Render API: reuse existing `/api/builder/render` (verify/extend) for live preview.
- Save: POST `/api/documents` with renderedContent + snippet order/overrides.
- Deep link: support query params `templateId`, `snippets` (csv ids), `fields` (json).

## Accessibility
- Keyboard reorder (Space to pick, ArrowUp/Down to move, Enter to drop) and buttons.
- Focus management when moving between steps; aria-live for step changes.
- Buttons ≥44px touch; focus outlines consistent.

## Testing
- Playwright path: select template, add 2 snippets, reorder, preview, copy; skip save when no auth.
- Unit/RTL: reducer/state machine for steps; hook tests for render API debounce.

## Open questions
- Should we allow saving drafts for anon users via localStorage? (out of scope now)
- Template field validation gating Next? (likely yes: required fields block next)

## Next actions
1) Build stepper + state machine component in `components/builder/Wizard.tsx`.
2) Replace current `BuilderClient` page with wizard wrapper; keep existing fallback sample data.
3) Wire render call with debounce (500ms) and loading states.
4) Add keyboard + DnD using `@dnd-kit` or minimal custom reorder with buttons.
5) Add Playwright smoke for wizard path (anon) to unblock CI.
