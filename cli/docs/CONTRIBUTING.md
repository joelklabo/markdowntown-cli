# Contributing

## Dev workflow essentials

### Git remote + tracking setup

The bd workflow assumes your `main` branch can pull/push against `origin`. If the remote is missing, configure it once:

```bash
git remote add origin <your-remote-url>
git fetch origin
git branch --set-upstream-to=origin/main main
```

After this, `git pull --ff-only` and `git push` should work as expected.

### Docs screenshots

The docs include deterministic screenshots under `docs/screenshots/scan-cli/`. To regenerate the scan output image:

```bash
python3 docs/scripts/render-scan-screenshot.py
```

If you prefer a different tool, ensure the output stays deterministic and update the docs accordingly.

### Fuzzing guidance

Run the matcher fuzz test locally with a short duration:

```bash
go test ./internal/scan -fuzz=FuzzCompileAndMatch -fuzztime=3s
```

Keep fuzz runs short for CI to avoid timeouts; longer runs are fine for local experimentation.

### Suggest fetcher tests

The suggest fetcher only allows HTTPS URLs. When adding fetcher tests, use
`httptest.NewTLSServer` and pass `server.Client()` into `FetcherOptions` so the
test client trusts the TLS cert.

### CLI transcript capture (zsh-safe)

Use `exit_code` (not `status`) to avoid zsh's read-only `$status` variable.

```bash
transcript="docs/cli-transcripts/<task-id>/cli.txt"
cmd=(go run ./cmd/markdowntown scan --repo . --repo-only)

mkdir -p "$(dirname "$transcript")"

{
  echo "$ ${cmd[*]}"
  "${cmd[@]}"
  exit_code=$?
  echo "exit_code=$exit_code"
} >"$transcript" 2>&1
```

### Pre-commit hooks (lefthook)

Optional pre-commit hooks run formatting, lint, and unit tests:

```bash
lefthook install
```

Hooks are optional; CI remains the source of truth.

### Sanity checks

```bash
make check
```

CI must always be green before merging or releasing changes.

### Writing Integration Tests

Integration tests using `go run` or `exec.Command` must ensure a writable environment for the subprocess.
Always set `HOME` and `GOCACHE` to temporary directories to avoid polluting the user's environment or failing in read-only sandboxes.

Use helpers like `testGoCaches(t)` (if available) or create temp dirs:

```go
home := t.TempDir()
cmd.Env = append(os.Environ(), "HOME="+home, "GOCACHE="+home+"/.cache/go")
```

### Troubleshooting

#### Push failures (403)

If `git push` fails with a 403 error, your environment might have a read-only `GITHUB_TOKEN` set. Unset it for the command:

```bash
env -u GITHUB_TOKEN git push origin main
```

#### Git worktree locks

If git operations fail with worktree lock errors, try cleaning up or creating a fresh clone.
When checking out a new branch fails, ensure you are branching from `origin/main` to avoid local state issues:

```bash
git fetch origin
git checkout -b my-branch origin/main
```

#### Test command quoting

When using `go test -run` with regex patterns containing pipes (`|`), ensure you quote the pattern to avoid shell interpretation:

```bash
go test -run "TestA|TestB" ./...
```

#### Go cache disk space

If `go test` or `make test` fails with "no space left on device", clear the Go build and test caches:

```bash
go clean -cache -testcache
```

On macOS, the cache typically lives in `~/Library/Caches/go-build`. You can verify free space with `df -h`. Ensuring at least 5GB of free space is recommended for large test runs.

### Release workflow (goreleaser)

Install goreleaser (choose one):

```bash
brew install goreleaser
```

```bash
go install github.com/goreleaser/goreleaser/v2@latest
```

Build a local snapshot release (no publish):

```bash
make snapshot
```

Release tags are published by GitHub Actions when you push a `vX.Y.Z` tag.
Run `make release` locally only if you intend to publish and have a valid
`GITHUB_TOKEN` with repo write access.
