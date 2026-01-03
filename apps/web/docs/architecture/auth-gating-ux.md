# Auth Gating UX (Inline Prompts & Retry)
Date: 2025-12-01  
Issue: markdowntown-7z8.31

## Goals
- Let anon users browse/copy/download freely while prompting sign-in for save/favorite/vote/comment actions.
- Preserve action context so the intended operation completes after login.

## Patterns
- Inline CTA states: show lock icon + tooltip “Sign in to …”; allow click to open auth prompt.
- Modal/panel gate: when user clicks gated action, open sign-in modal with summary of intended action.
- After auth, redirect back with `callbackUrl` and serialized pending action (target type/id, action).
- For builder save, keep draft state client-side and replay save on return.

## Implementation checklist
- [ ] Add gate component that wraps gated buttons and triggers sign-in modal + action payload.
- [ ] Wire NextAuth `callbackUrl` to include return path and action params; on page load, replay action if permitted.
- [ ] Show optimistic UI copy/favorite/vote toggle but roll back if auth missing.
- [ ] Ensure API returns 401 with clear error; client detects and opens gate.
- [ ] Respect cache separation: user overlay fetch (`/api/user/state`) uncached; public payload cached.
- [ ] Analytics: track gate shown, gate accepted, gate dismissed.

## UX details
- Keep prompts concise; include benefit copy (“Save to access later”, “Vote to surface quality”).
- Do not block copy/download; gated actions only.
- Mobile: use bottom sheet for sign-in prompt.
