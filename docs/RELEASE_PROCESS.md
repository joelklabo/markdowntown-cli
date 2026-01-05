# Release Process

This document describes the release process for the markdowntown monorepo, which includes:
- CLI binaries (via GoReleaser)
- Web container image
- Worker container image
- VS Code extension

## Prerequisites

- Write access to the repository
- Access to push tags
- GitHub Actions workflows enabled
- (For VS Code extension) VS Code Marketplace publisher access

## Release Types

### CLI Binary Release

CLI binaries are released via GoReleaser when a version tag is pushed.

**Platforms supported:**
- Linux: amd64, arm64
- macOS: amd64 (Intel), arm64 (Apple Silicon)
- Windows: amd64

**Steps:**

1. **Update version** (if needed):
   ```bash
   # Version is extracted from git tag, no code changes needed
   ```

2. **Create and push tag:**
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

3. **Wait for CI:**
   - GitHub Actions will trigger the `release.yml` workflow
   - GoReleaser runs from `cli/` directory
   - Binaries built for all platforms
   - Release created on GitHub with archives + checksums

4. **Verify release:**
   - Check https://github.com/joelklabo/markdowntown-cli/releases
   - Download and test binaries for each platform

### Docker Image Release

Web and worker images are released automatically when a version tag is pushed.

**Images:**
- `ghcr.io/joelklabo/markdowntown-cli/web:v1.2.3`
- `ghcr.io/joelklabo/markdowntown-cli/worker:v1.2.3`

**Platforms:**
- linux/amd64
- linux/arm64

**Steps:**

1. **Create and push tag** (same as CLI):
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

2. **Wait for CI:**
   - `docker-release.yml` workflow triggers
   - Builds both web and worker images
   - Multi-platform builds (amd64 + arm64)
   - Pushes to GitHub Container Registry
   - Tags: `v1.2.3`, `1.2`, `1`, `main-<sha>`

3. **Verify images:**
   ```bash
   docker pull ghcr.io/joelklabo/markdowntown-cli/web:v1.2.3
   docker pull ghcr.io/joelklabo/markdowntown-cli/worker:v1.2.3
   ```

### VS Code Extension Release

See `.github/workflows/release-vscode.yml` for VS Code extension release automation.

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (v2.0.0): Breaking changes
- **MINOR** (v1.2.0): New features, backwards compatible
- **PATCH** (v1.2.3): Bug fixes, backwards compatible

## Pre-release Checklist

Before creating a release tag:

- [ ] All CI checks passing on `main`
- [ ] CHANGELOG.md updated (if applicable)
- [ ] Version bump committed (if needed for package.json, etc.)
- [ ] Breaking changes documented
- [ ] Migration guide prepared (if breaking changes)

## Post-release Checklist

After release completes:

- [ ] Verify release artifacts on GitHub
- [ ] Test CLI binary download + execution
- [ ] Verify Docker images are pullable
- [ ] Update deployment environments (staging → prod)
- [ ] Announce release (if significant)

## Troubleshooting

### GoReleaser fails

- Check `cli/.goreleaser.yml` syntax
- Ensure `cli/go.mod` is valid
- Verify tag format matches `v*`

### Docker build fails

- Check Dockerfile syntax
- Verify paths in COPY instructions match monorepo layout
- Check for missing dependencies

### CI cache issues

GitHub Actions caches are scoped by workflow + branch. To invalidate:
- Push a commit that touches `.github/workflows/*.yml`
- Or manually clear caches in GitHub UI (Settings → Actions → Caches)

## Rollback

See `docs/runbooks/deploy-rollback.md` for rollback procedures.

## Release Artifacts

### CLI Binaries

- Location: GitHub Releases
- Naming: `markdowntown_v1.2.3_linux_amd64.tar.gz`
- Contents: `markdowntown` binary + data files

### Docker Images

- Location: GitHub Container Registry (ghcr.io)
- Retention: Indefinite (manually prune old versions if needed)
- Tags: version + semver aliases

### VS Code Extension

- Location: VS Code Marketplace
- Retention: Per marketplace policy

## Security

- CLI binaries are built with CGO_ENABLED=0 (no external deps)
- Docker images use minimal base images (debian-slim, node-slim)
- Checksums provided for all CLI releases
- Images signed with GitHub Actions OIDC (optional, configure if needed)
