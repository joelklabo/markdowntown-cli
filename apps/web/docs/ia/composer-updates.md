# Composer/Editor Updates (Snippet model + Library insertion)
Date: 2025-12-01  
Issue: markdowntown-7z8.30

## Goals
- Update composer to use the new `Snippet` model (slug, visibility, tags, kind, stats).
- Allow inserting items from the public library/builder into the editor.
- Preserve existing three-panel workflow while aligning terminology (Snippet vs Section).

## UX changes
- Left panel: list of user Snippets (owned/private) plus “Insert from library” entry point (opens browse modal).
- Middle editor: title + content; expose tags/kind selectors; visibility selector (private/unlisted/public for authed).
- Right preview: rendered markdown with sanitized output.
- Actions: Copy, Download, Save; re-label “Section” → “Snippet”.
- When inserting from library, show readonly badge if snippet is public/shared; allow copying into user-owned clone.

## Data/contract updates
- Calls to `/api/sections` should map to Snippet (new fields); support slug in responses.
- Handle visibility in create/update; default private.
- Add tags/kind inputs; validate length and allowed kinds.
- When inserting from library, create a new user-owned snippet copy (respect attribution?) and add to list.

## Checklist
- [ ] Rename UI copy and variable names from Section→Snippet.
- [ ] Add tags/kind/visibility fields to editor form with validation.
- [ ] Wire “Insert from library” modal to public search/list endpoints; on insert, clone into user snippets.
- [ ] Update preview to use sanitized render pipeline.
- [ ] Adjust tests and mocks to use `prisma.snippet`.
- [ ] Analytics: track insert_from_library, save_snippet, copy_snippet.
- [ ] Ensure feature flags respected (`public_library`, future `builder_v2`).
