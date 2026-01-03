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
