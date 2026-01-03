# Template Fill & Preview API
Date: 2025-12-01  
Issue: markdowntown-7z8.21

## Goals
- Render a Template with provided placeholder values server-side, returning both rendered markdown and raw template/body.
- Power form-fill preview on template detail page and builder.

## Endpoints (App Router)
- `POST /api/templates/[slug]/render` (public)
  - body: `{ fields: Record<string, string | number | boolean | string[]> }`
  - returns: `{ rendered: string, raw: string, warnings?: string[] }`
- `POST /api/templates/render` (by id; authed optional)
  - body: `{ templateId: string, fields: {...} }`

## Rules
- Validate fields against Template.fields schema (type/default/required).
- Escape user values before substitution; strip HTML/script/iframe/javascript:.
- Allow missing optional fields; use defaults when provided.
- Enforce max length per value to prevent abuse; truncate with warning.

## Caching
- Responses `Cache-Control: no-store` (user-specific input).
- Template fetch can be cached/tagged; render response should not be cached.

## Integration points
- Template detail page: form panel posts to render endpoint; updates preview pane.
- Builder step 1: selecting a template pulls schema; render runs when fields change.
- Export: re-use same render helper before saving Document.

## Implementation checklist
- [ ] Shared render helper that takes template body + fields schema + values and returns sanitized markdown.
- [ ] API route(s) using helper; return warnings (missing required, truncated).
- [ ] Validation errors return 400 with message per field.
- [ ] Unit tests for substitution, escaping, required/defaults, multi-select handling.
- [ ] Rate limit render endpoint (per-IP) to avoid abuse.
