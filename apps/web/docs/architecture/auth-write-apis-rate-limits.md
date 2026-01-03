# Auth-only Write APIs + Rate Limits (votes/comments/creates)
Date: 2025-12-01  
Issue: markdowntown-7z8.22

## Scope
- Keep all write/engagement actions behind auth while public reads stay open.
- Apply per-IP and per-user rate limits to protect votes/comments/favorites/creates.

## API surfaces
- Votes: `POST /api/votes`, `DELETE /api/votes/:id`
- Favorites: `POST /api/favorites`, `DELETE /api/favorites/:id`
- Comments: `POST /api/comments`, `DELETE/PATCH /api/comments/:id`
- Snippet/Template/Document creates/updates/deletes (auth-only)

## Auth enforcement
- Middleware matcher for write routes only; use `auth()` / `getToken()` inside handlers.
- Return 401 when no session; do not leak cacheable responses for writes.

## Rate limiting
- Buckets: per-IP and per-user; stricter for comments/votes (e.g., 30/min IP, 10/min user).
- Implement in middleware using KV/Redis (Upstash/Vercel KV) to short-circuit before handler.
- Return 429 with `Retry-After`; log to abuse channel.

## Validation/safety
- Reuse comment/body sanitization; block `<script>/<iframe>/javascript:`.
- Votes only allow +1/-1; favorites idempotent; validate target visibility (public or owner).
- Enforce max comment length; throttle first-comment with captcha hook (reuse anonymous-write doc).

## Caching/variants
- Write endpoints `Cache-Control: no-store`.
- Public read endpoints should set `Vary: Cookie` only when user-specific overlays are present; keep write responses uncached.

## Testing checklist
- 401 on unauthenticated POST vote/comment/create.
- 429 after exceeding per-IP/user limits.
- Successful vote/favorite toggles counters; ensures target visibility guard.
- Comments reject disallowed markup and oversize bodies.

## References
- docs/research/anonymous-read-auth-writes.md
- docs/migrations/engagement-models.md
