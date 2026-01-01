---
name: markdowntown-cli
description: Repo workflow for markdowntown-cli development and scans.
---

# markdowntown-cli

- Build the scan CLI per `docs/scan-spec-v1.md`.
- Prefer `rg` for search and keep changes small and deterministic.
- Run `make lint` and `make test`; CI must be green before finishing.
- Avoid destructive git commands unless explicitly asked.
