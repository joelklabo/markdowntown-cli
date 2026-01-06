# Source Registry (`doc-sources.json`)

The source registry defines authoritative documentation sources used by `markdowntown suggest` and `markdowntown audit`. It pairs each client with vetted URLs and assigns a trust tier used for fail-closed suggestions.

## Discovery

`doc-sources.json` is discovered in this order:

1. `MARKDOWNTOWN_SOURCES` (explicit file path)
2. `$XDG_CONFIG_HOME/markdowntown/doc-sources.json` (or `~/.config/markdowntown/doc-sources.json`)
3. `/etc/markdowntown/doc-sources.json`
4. `doc-sources.json` next to the executable

If multiple registries are found without an override, the command fails.

## Schema

Top-level fields:

- `version` (string): schema version identifier
- `allowlistHosts` (string[]): hostnames allowed for fetches (no schemes or paths)
- `sources` (object[]): documentation sources

Each source entry:

- `id` (string): unique identifier
- `tier` (string): `tier-0`, `tier-1`, or `tier-2`
- `client` (string): `codex`, `copilot`, `vscode`, `claude`, `gemini`, or `standards`
- `url` (string): HTTPS URL to the authoritative source
- `refreshHours` (number): refresh cadence in hours
- `tags` (string[], optional): freeform tags
- `notes` (string, optional): operator notes

## Tiers

- `tier-0` / `tier-1`: eligible for suggestions when proof objects exist.
- `tier-2`: retained for audit/reference only (no suggestions).

## Example

```json
{
  "version": "1.0",
  "allowlistHosts": ["developers.openai.com"],
  "sources": [
    {
      "id": "codex-agents-md",
      "tier": "tier-0",
      "client": "codex",
      "url": "https://developers.openai.com/codex/guides/agents-md/",
      "refreshHours": 24
    }
  ]
}
```

## Cache layout

Suggested cache layout:

- Metadata: `$XDG_CACHE_HOME/markdowntown/suggest/metadata.json`
- Snapshots: `$XDG_DATA_HOME/markdowntown/suggest/snapshots/*.body`

These caches are populated during fetches and used in `--offline` mode.

## Refresh pipeline

- Refresh entrypoints: `scripts/docs/refresh.ts`, `POST /api/docs/refresh`, or the scheduled job defined in `infra/modules/jobs-doc-refresh.bicep`.
- The pipeline fetches the registry from `DOC_REGISTRY_URL`/`DOC_REGISTRY_PATH` (defaults to `cli/data/doc-sources.json` if present) and validates HTTPS URLs, allowlist hosts, and refresh cadences before publishing.
- Last-good snapshots are stored under `.cache/docs/registry/last-good.json` (configurable via `DOC_STORE_PATH`) and are served when a refresh attempt fails to keep the CLI/Web flows fail-stale.
- Corrupt or oversized payloads are rejected; validation mirrors the CLI registry rules (unique IDs, HTTPS only, host allowlist enforcement).
## Fetch Bridge (WASM)

The WASM engine uses a fetch bridge to retrieve external sources while in the browser or Node environments.

- **Direct Bridge**: Used when the environment allows direct HTTPS fetches (e.g., CLI).
- **Proxy Bridge**: Used when CORS or other restrictions prevent direct access (e.g., Browser). Requests are routed through `GET /api/engine/fetch?url=...`.

Both bridges enforce the `allowlistHosts` defined in the registry. The Proxy Bridge (Node) reads the allowlist from `cli/data/doc-sources.json` and rejects unauthorized hosts with a `403 Forbidden` response.

### Delivery Optimization

The WASM engine is served with the following optimizations:

- **Compression**: Pre-compressed with Brotli (`.wasm.br`) for reduced payload size.
- **Caching**: Configured with immutable cache headers in production (`public, max-age=31536000, immutable`).
- **WASM Loader**: A dedicated loader handles decompression and streaming instantiation where supported.
