# ADR-0001: Monorepo layout

Status: Accepted
Date: 2026-01-03

## Context

We are merging the Go CLI/LSP and the Next.js web app into a single repository to reduce drift and enable shared contracts and tooling. The layout must support independent builds/tests while enabling shared packages and consistent docs.

## Decision

Adopt the following top-level layout:

- `apps/web` for the Next.js app and API routes
- `cli` for the Go CLI/LSP and VS Code extension
- `packages` for shared JS/TS packages (engine loader, schemas)
- `infra` for Azure Bicep and environment configs
- `docs` for shared architecture, runbooks, and specs
- root `pnpm-workspace.yaml` and `go.work` for tooling

## Consequences

- Tooling is centralized; CI can target paths for web/cli/packages.
- Web and CLI remain separable but can share contracts and fixtures.
- Moves require updating scripts, Dockerfiles, and CI paths.
- A migration guide is required to prevent split-brain between old and new paths.

## Links

- docs/architecture/monorepo-layout.md
