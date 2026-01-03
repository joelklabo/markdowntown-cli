# Security Checklist: Public Rendering & Exports
Date: 2025-12-01
Epic: markdowntown-7z8

## Threats
- XSS via user-submitted markdown (scripts, iframes, JS URLs).
- Injection in template placeholders or overrides in builder/export.
- Abuse of public endpoints for scraping or spam via comments/votes.

## Mitigations
- Markdown rendering: use remark/rehype with sanitization (strip script/iframe/event handlers, block javascript: URLs). Consider `rehype-sanitize` with custom schema.
- Exports: ensure generated agents.md contains only markdown/plaintext—no embedded HTML; escape user inputs in templates/overrides.
- API validation: reuse existing content validators; extend to Templates (fields schema) and Comments.
- Rate limiting: keep per-IP/user limits on write endpoints; add specific buckets for vote/comment/favorite.
- Visibility enforcement: public APIs only return visibility=PUBLIC; owner-only for private/unlisted.
- CSP: ensure responses include CSP default-src 'self'; script-src none for exported markdown where applicable.
- OG/image endpoints: validate slug, 404 on non-public; limit font/assets; set s-maxage.
- Logging/abuse: log rate-limit hits and disallowed content; add report-abuse endpoint if not already.
- **Tests:** add regression cases that ensure malicious markdown (script/iframe/javascript: links) is stripped in preview, detail, and export.

## Action items
- Add sanitization step to markdown rendering pipeline (frontend + server). Enable on preview and export.
- Add content validation for Template fields and Comment body length/html stripping.
- Ensure export/download routes use sanitized content and set `Content-Disposition: attachment`.
- Extend rateLimiter buckets for engagement endpoints.
- Automated tests: malicious markdown should not execute (script/iframe/javascript: links) in preview/detail/export.
