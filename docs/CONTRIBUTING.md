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
