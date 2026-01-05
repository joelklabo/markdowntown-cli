# Markdowntown CLI User Guide

## Overview
The CLI scans for AI tooling config files and can audit or suggest improvements. This guide is a quick entry point; the canonical specs live in `cli/docs/`.

## Install / Uninstall

Homebrew:

```bash
brew install markdowntown
brew uninstall markdowntown
```

Go install:

```bash
go install ./cmd/markdowntown
```

Uninstall (Go install):

```bash
rm "$(go env GOPATH)/bin/markdowntown"
```

## Commands

- `markdowntown scan` → see `cli/docs/scan-spec-v1.md` for flags and schema.
- `markdowntown audit` → see `cli/docs/audit-spec-v1.md` for flags and schema.
- `markdowntown suggest` → see `cli/docs/suggest-spec-v1.md` for flags and schema.

## VS Code LSP diagnostics
- Diagnostics and quick fixes: `cli/docs/architecture/lsp-diagnostics.md`.
- VS Code integration overview: `docs/USER_GUIDE.md`.

![VS Code Diagnostics](./screenshots/lsp-diagnostics/diagnostics.png)

## Related docs
- Canonical user guide (monorepo): `docs/USER_GUIDE.md`.
- Source registry schema: `docs/source-registry.md`.
