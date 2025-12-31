# Suggest CLI transcripts

This folder stores CLI transcript evidence for the suggest/audit/resolve workflow.

- `cli-commands.txt` captures a non-interactive `suggest --offline` run with piped stdin.

When recording offline transcripts, keep `MARKDOWNTOWN_SOURCES`, `XDG_DATA_HOME`, and
`XDG_CACHE_HOME` inline on the command so reviewers can see the isolated cache and
registry used for the run.

Reproduce:

```bash
XDG_DATA_HOME="$(mktemp -d)" \
XDG_CACHE_HOME="$(mktemp -d)" \
MARKDOWNTOWN_SOURCES=data/doc-sources.json \
go run ./cmd/markdowntown suggest --offline --format json
```
