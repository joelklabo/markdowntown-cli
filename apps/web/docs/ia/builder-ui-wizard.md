# agents.md Builder UI (Wizard)
Date: 2025-12-01  
Issue: markdowntown-7z8.29

## Flow (5 steps)
1) Template or Blank: cards for featured templates + “Start blank”.
2) Add snippets: browse/search/filter; favorites tab (authed); add buttons.
3) Arrange: drag-and-drop list; per-item inline overrides; visibility badges.
4) Preview: rendered + raw; warnings for private/unlisted items; stats.
5) Export: Copy, Download (.md); authed can Save as Document (name + visibility).

## UI details
- Progress bar/steps indicator across top.
- Sticky footer actions: Back/Next (or Finish when export).
- Inline sign-in prompt when hitting gated actions (save/favorite); resume step on return.
- Builder tray on desktop; full-screen panels on mobile.
- Surface template field edits from Step 1 in later steps; allow returning to edit.

## Data/state
- Store: `templateId`, `templateFields`, `snippets[] { id, title, content, visibility }`, `overrides`, `order`.
- Derived: rendered preview (via builder render API), `hasPrivateContent`, stats counts.
- Persisted for authed: optional draft in localStorage? (future).

## Actions
- Copy/download/export uses rendered content from Step 4.
- Save as Document calls `/api/documents` with snippets/order/overrides + renderedContent.
- Add to builder from elsewhere should deep-link into wizard with preloaded items.

## Checklist
- [ ] Wizard steps UI; mobile-friendly.
- [ ] Drag-and-drop arrange; keyboard accessible reorder.
- [ ] Inline overrides UI with validation.
- [ ] Live preview that stays in sync after edits.
- [ ] Export + Save actions with success toasts.
- [ ] Deep-link support from “Use template” / “Add to builder” buttons.
- [ ] Analytics: step progression, add_to_builder, export, save_document.
