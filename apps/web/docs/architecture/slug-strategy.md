# Slug Strategy
Date: 2025-12-01
Epic: markdowntown-7z8

## Goals
- Stable, shareable URLs for Snippets, Templates, Documents.
- Avoid collisions; be reversible to ids for internal lookups.

## Format
- Base: `slugify(title, lower, hyphen)` limited to 60 chars.
- Collision handling: append `-<shortid>` where `shortid = substr(id, 0, 6)` (cuid prefix) if slug already taken.
- Allowed chars: a–z, 0–9, hyphen; trim leading/trailing hyphen; collapse duplicates.

## Generation
- On create: compute slug from title; check uniqueness; append shortid if needed.
- On update: if title changes and item is PRIVATE/UNLISTED, regenerate slug once; if PUBLIC, keep existing slug to avoid breaking links. Allow manual override? (later).

## Lookup
- Detail pages accept either slug or id; prefer slug in links.
- APIs accept slug; fall back to id for backward compatibility.

## Backfill
- For existing rows: slugify title, then apply collision rule; set all to PRIVATE except seed rows.

## SEO
- Use slug in canonical/OG/sitemap; avoid exposing ids in public URLs once migration done.
