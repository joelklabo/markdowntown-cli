# Lo-fi Wireframes (text) – Landing, Browse, Detail, Builder
Date: 2025-12-01
Epic: markdowntown-7z8

## Landing page (desktop)
[Header] Brand | Browse | Templates | Builder | Tags | Docs | ThemeToggle | Sign in / Avatar  
[Hero] Headline + subcopy + CTAs (Use a template, Browse). Right: illustrative card stack.  
[Module] Featured carousel (3 cards) – badges: Staff Pick / Trending; actions: Copy, Use template.  
[Module] Trending grid (6 cards) – stats (copies/views/votes), tag chips, quick Copy.  
[Module] New this week (list) – timestamped, tag pills.  
[Module] Tag cloud – top tags sized by frequency; click → tag page.  
[Module] Most-copied agents.md – list with Copy/Download buttons.  
[Module] Why sign in – benefits (save/favorite/vote/comment) with CTA.  
[How it works] 3 steps with icons + CTA to Builder.  
[Footer] Links: Docs, Privacy, GitHub, Status.

## Browse (library) page
[Top bar] Search input (⌘/), sort tabs (Trending | New | Most copied | Top rated), type filters (All | Snippets | Templates | Files).
[Left rail] Tag multi-select, Tool/Model filter, Length slider (optional), Visibility (public only), Reset filters.
[Results] Responsive grid of cards with: title, badges (New/Trending/Staff Pick), stats (copies/views/votes), tags, type icon, quick buttons (Copy, Download, Add to builder). Pagination or infinite scroll.

## Snippet detail
[Sticky header] Title + tags + type + stats; actions: Copy, Download, Add to builder; gated actions: Favorite, Vote, Comment (lock icon when anon). Inline sign-in prompt preserves scroll and retries action post-auth.
[Body] Tabs (Rendered | Raw). Rendered preview left; Raw code block right on desktop; stacked tabs on mobile.
[Related] Carousel/list “People also use” + same tags + same author.
[Comments] Collapsible, auth-gated.

## Template detail
Same frame as snippet detail, with an additional Form panel:
- Fields form (name/type/default/description); validation errors inline.
- Live preview updates as fields change; show placeholder chips.
- Actions: Copy rendered, Download, Save as Document (gated), Add to builder.

## agents.md Builder (wizard)
Step 1: Choose template or Start blank (cards). Continue CTA.
Step 2: Add snippets – search + filters; list with Add buttons; "My favorites" tab if authed.
Step 3: Arrange – drag list; per-item inline overrides (title/content toggle); visibility badges if mixed.
Step 4: Preview – rendered markdown (left) + raw (right); stats of components; warnings if private snippets in public export.
Step 5: Export – buttons: Copy agents.md, Download (.md). For authed: Save as Document, Name, Visibility selector.
Auth gating: modal/toast preserves wizard state; returns to same step post-login.

## Mobile notes
- Bottom nav: Browse, Templates, Builder, Tags, Profile.
- Filters open in sheet; detail Rendered/Raw as tabs; cards become full-width list.
