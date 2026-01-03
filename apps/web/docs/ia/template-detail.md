# Template Detail Page (Form-Fill Preview)
Date: 2025-12-01  
Issue: markdowntown-7z8.28

## Content & layout
- Header: title, tags, type “Template”, author, updated date, badges (Staff pick/Trending/New).
- Actions (sticky rail / mobile bottom bar): Use template, Copy, Download, Add to builder, Save as Document (authed), Favorite/Vote (gated).
- Tabs/sections: Rendered preview, Raw template body, Fields schema panel (optional).
- Form panel: fields (name/type/default/description/required); live preview updates as values change.
- Related: “Similar templates” + “Frequently copied with”.
- Stats: views, copies, downloads, uses, votes, favorites.

## Behavior
- Form fill posts to template render API (`/api/templates/[slug]/render`); updates rendered preview.
- Use template → opens builder with template preloaded (and current field values if provided).
- Copy/Download uses rendered preview; warn if required fields empty (highlight missing).
- Save as Document (authed): fills placeholders, saves rendered content + Document created.
- Gated actions prompt sign-in and retry.

## Data
- GET `/api/public/templates/[slug]` returns body, fields schema, rendered (with defaults), stats, related IDs.
- Auth overlay fetch for vote/favorite; main payload cached.

## Checklist
- [ ] Form panel with validation + inline errors.
- [ ] Live preview using render API; throttled/debounced updates.
- [ ] Sticky actions; mobile bottom CTA.
- [ ] Copy/Download/Use template/Add to builder wired.
- [ ] Save as Document (authed) integration with builder/export flow.
- [ ] Related modules hooked to tag/related feeds.
- [ ] Analytics: field edits, render calls, use template, copy/download, save document.
