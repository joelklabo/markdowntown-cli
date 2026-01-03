# Engagement Models: Favorites/Pins, Votes, Comments
Date: 2025-12-01  
Issue: markdowntown-7z8.15

## Goals
- Allow signed-in users to favorite/pin content, vote, and comment on Snippets/Templates/Documents.
- Keep public read flows fast and cacheable; writes remain authed + rate limited.

## Schema
- `Vote`: `id`, `userId`, `targetType (snippet|template|document)`, `targetId`, `value (+1/-1)`, timestamps. Unique `(userId, targetType, targetId)` to prevent dupes.
- `Favorite` (or `Pin`): `id`, `userId`, `targetType`, `targetId`, timestamps. Unique `(userId, targetType, targetId)`.
- `Comment`: `id`, `userId`, `targetType`, `targetId`, `body`, `visibility` (active/hidden), timestamps.
- Stats counters on entities (already planned): `favoritesCount`, `commentsCount`, `votesUp`, `votesDown`.
- Indexes: `(targetType, targetId)`, `(userId, targetType)`, `createdAt` on Comment.

## API (App Router)
- Votes: `POST /api/votes` (toggle/upsert), `DELETE /api/votes/:id` optional; returns updated score.
- Favorites/Pins: `POST /api/favorites`, `DELETE /api/favorites/:id`; returns current state.
- Comments: `POST /api/comments`, `GET /api/comments?targetType=&targetId=`, `DELETE/PATCH` for moderation (owner/admin).
- Public list endpoints may embed `userState` via separate un-cached fetch when session present; otherwise serve cached stats only.

## Validation & safety
- Auth required for all writes; rate limit per-IP + per-user (stricter for comments).
- Comment body: max length, strip HTML/JS, block `<script>`, `<iframe>`, and `javascript:` URLs.
- Votes only allow +1 or -1; favorites idempotent.
- Respect visibility: only public content exposed; owner can see own private items.

## Caching/invalidations
- Public counters served from entity rows; update counters on write or via rollup from Event table.
- Tag caches: `revalidateTag('snippet:<slug>')`, `favorite:<target>`, `vote:<target>` etc. after mutations.
- Comments list responses `s-maxage=30, stale-while-revalidate=120`, `Vary: Cookie` if user-specific flags returned.

## UI considerations
- Toggle buttons should be optimistic on the client; roll back on error.
- Show vote score with arrows, favorite as heart/star; comment form shows length counter.
- Inline sign-in prompt preserves intended action.

## Risks
- Spam/abuse in comments: add captcha for first-time or high-frequency users; moderation visibility flag.
- Hot targets could see counter contention—consider atomic increments or event rollups instead of live counts.
