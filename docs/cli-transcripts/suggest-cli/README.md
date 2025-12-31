# Suggest CLI transcripts

This folder stores CLI transcript evidence for the suggest/audit/resolve workflow.

- `cli-commands.txt` captures a non-interactive `suggest --offline` run with piped stdin.

Reproduce:

```bash
printf "ignored\n" | go run ./cmd/markdowntown suggest --offline --format json
```
