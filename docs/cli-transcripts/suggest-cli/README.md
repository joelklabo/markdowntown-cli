# Suggest CLI transcripts

This folder stores CLI transcript evidence for the suggest/audit/resolve workflow.

- `cli-commands.txt` captures a non-interactive `suggest --offline` run with piped stdin.

Reproduce:

```bash
XDG_DATA_HOME="$(mktemp -d)" \
XDG_CACHE_HOME="$(mktemp -d)" \
MARKDOWNTOWN_SOURCES=data/doc-sources.json \
go run ./cmd/markdowntown suggest --offline --format json
```
