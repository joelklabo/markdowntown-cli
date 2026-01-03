# Tagging Taxonomy & Trending Tags Computation
Date: 2025-12-01  
Issue: markdowntown-7z8.17

## Goals
- Consistent tagging across Snippets/Templates/Documents to power browse/search/trending/tag cloud.
- Compute trending tags windows (7d/30d) without heavy infra.

## Tagging rules
- Normalize to lowercase, kebab-case; limit to 5-8 tags per item.
- Recommended facets: tool/model (e.g., gpt-4), domain (docs, support), action (summarize), format (system, style).
- Reject tags with spaces leading/trailing, >32 chars, or unsafe chars.

## Data model
- Keep string[] tags on each entity (Snippet/Template/Document).
- Optional future normalization table `Tag` with unique name + counts; not required initially.

## Trending tags computation
- Query counts filtered by updatedAt window (7d/30d) across public items:
  ```sql
  SELECT tag, count(*) AS count
  FROM (
    SELECT unnest(tags) AS tag, updated_at FROM snippets WHERE visibility='PUBLIC'
    UNION ALL
    SELECT unnest(tags), updated_at FROM templates WHERE visibility='PUBLIC'
    UNION ALL
    SELECT unnest(tags), updated_at FROM documents WHERE visibility='PUBLIC'
  ) t
  WHERE updated_at > now() - interval '7 days'
  GROUP BY tag
  ORDER BY count DESC
  LIMIT 50;
  ```
- Weight by recency (optional): `count * exp(-days/14)`.

## API / UI
- Tag cloud endpoint already planned (`/api/public/tags`); extend with `window` param and optional recency weighting.
- Display tag chips on landing/browse and tag pages.
- Allow multi-tag filters in search/browse.

## Checklist
- [ ] Enforce tag normalization/limits on create/update.
- [ ] Add trending tag query (7d/30d) and expose via API.
- [ ] Cache tag responses (5-10m) with revalidate on write/rollup.
- [ ] Update UI components to consume windowed tags (if needed).
- [ ] Analytics: track tag filter usage.
