---
name: research-web
description: Standard web research workflow and source evaluation (SIFT, lateral reading, CRAAP), search strategy, triangulation, and citations. Use when asked to research topics, gather sources, or validate claims.
---

# Web Research

## Overview
Use this skill to conduct reliable web research, evaluate sources, and produce well-attributed findings for general and technical topics (APIs, code, UI frameworks, components).

## Workflow
1) Define scope and recency needs (what must be current vs. historical).
2) Plan a search strategy (queries, synonyms, and sources).
3) Execute searches; use operators and filters when helpful (e.g., `site:`, `filetype:`, `intitle:`, `inurl:`).
4) If the topic is technical (code, APIs, UI frameworks, components), follow Technical Research Steps.
5) Evaluate sources using the Source Evaluation section.
6) Prefer primary sources (official docs, research papers, specs) and triangulate at least 2 independent sources for non-trivial claims.
7) Record citations with dates, note conflicts or uncertainty, and summarize with clear limitations.

## Search Strategy
- Use multiple query variants; include synonyms and domain-specific terms.
- Apply date filters when recency matters; record the date range.
- Prefer built-in search tools/filters for time-bounding when available.
- Use `site:` to target authoritative domains, but verify currency.
- Search operators and ranking behavior change over time; validate critical queries with current docs.
- For technical topics, search across layers: official docs site, source repo (issues/releases), package registry, and relevant standards/specs.

## Technical Research Steps (code, APIs, UI frameworks/components)
- Identify the exact product/library name, version, and ecosystem (language, framework).
- Prefer official documentation, API references, and release notes/changelogs.
- Validate examples against the current major/minor version; note version-specific behavior.
- Check migration guides or breaking change notes when versions are close or unclear.
- Check package registries or repo releases/tags for the latest stable version and support windows.
- Review issue trackers for known breakages, regressions, or deprecations affecting the topic.
- For UI components, verify accessibility guidance, theming tokens, and required peer deps.
- If sample code is from third parties, cross-check against official docs or tests.

## Topic-Specific Strategies
- Code/APIs: prioritize official API refs, type definitions, and changelogs; confirm examples compile against the stated version and note any deprecations.
- Design/Visual: look for official brand guidelines, design tokens, and component libraries; verify asset usage rights.
- UI Components: verify accessibility (ARIA/roles), theming tokens, and required peer dependencies; check component API stability.
- UX/Flows: prefer user journey specs, product requirements, and usability heuristics; distinguish behavior from visuals.
- CI/CD: find the exact CI provider docs and repo config (e.g., YAML files); confirm env vars, caches, and matrix support; verify secrets handling, fork/PR policies, and least-privilege defaults (tokens/permissions).
- GitHub Workflows: use GitHub Actions docs for syntax, contexts, and permissions; set `permissions` at workflow/job level to least privilege for `GITHUB_TOKEN`; prefer pinning actions to full commit SHAs; check action versions and deprecations; audit third-party action code and verify creator trust signals (e.g., verified creators).
- AI agents: prioritize system/developer prompt rules, tool docs, and sandbox/permission constraints; verify behavior with current product docs and note any model/version limitations.

## Documentation
- Keep a short search log: date of last search, source/platform, full query strings, filters/limits, and rough result counts.
- If you refine or rerun searches, log the updates and why.

## Output Format
- Findings: concise bullet list of conclusions.
- Evidence: cite primary sources first; note version/date for technical claims.
- Uncertainties: list conflicts, missing data, or assumptions.
- Recency: call out anything that may have changed since the search date.

## Source Evaluation
- SIFT: Stop before sharing, Investigate the source, Find better coverage, Trace claims to original context (go upstream).
- Lateral reading: practice click restraint, leave the page, and verify the source/claim across independent sources (do not rely only on the site’s “About” page).
- CRAAP: Currency, Relevance, Authority, Accuracy, Purpose.

## Guardrails
- If sources conflict, report the disagreement and cite both.
- Avoid relying on a single source for high-stakes or fast-changing facts.
- If no reliable sources exist, say so and explain what was insufficient.
- Trace claims to primary sources when possible; if only secondary sources exist, note the limitation.
- If only one source is available, mark the claim as lower confidence.
- Watch for marketing bias or SEO content; prefer neutral or primary sources.
- If information is region- or policy-specific, state the applicable region and date.
