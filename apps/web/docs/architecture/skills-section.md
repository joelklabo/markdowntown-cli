# Skills section data model + API contract

## Overview
Skills are stored as a dedicated artifact type backed by UAM v1 payloads. The Skills surface reads/writes the same artifact + artifact version tables, but the UAM payload emphasizes `capabilities` as the source of truth for skill definitions.

Note: `src/lib/uam/schema.ts` defines the legacy UniversalAgentDefinition (pre-UAM v1) used by the `/translate` compile API. Skills should use UAM v1 types (`src/lib/uam/uamTypes.ts`) and validation (`src/lib/uam/uamValidate.ts`).

## Artifact model
- Artifact.type: `SKILL` (new enum value)
- Artifact.title: skill pack title
- Artifact.description: optional summary
- Artifact.tags: array of tags (e.g. "refactor", "typescript", "release")
- Artifact.targets: array of target ids (e.g. "agents-md", "github-copilot", "claude-code")
- Artifact.hasScopes: true if any non-global scopes exist in the UAM payload
- ArtifactVersion.uam: UAM v1 payload with capabilities

## UAM v1 payload shape (skills)
```json
{
  "schemaVersion": 1,
  "meta": {
    "title": "Build Release Notes",
    "description": "Generate release notes from merged PRs"
  },
  "scopes": [
    { "id": "global", "kind": "global", "name": "Global" }
  ],
  "blocks": [],
  "capabilities": [
    {
      "id": "release-notes",
      "title": "Release Notes",
      "description": "Draft release notes from git history",
      "params": {
        "format": "markdown",
        "includeBreaking": true
      }
    }
  ],
  "targets": [
    { "targetId": "claude-code", "adapterVersion": "1", "options": { "exportSkills": true } },
    { "targetId": "agents-md", "adapterVersion": "1", "options": {} }
  ]
}
```

## Skill capability schema
Skill definitions map to `UamCapabilityV1`:
- `id`: unique, URL-safe slug preferred (required, min length 1)
- `title`: display label for UI (optional)
- `description`: short description (optional)
- `params`: JSON object of parameter defaults (optional)

UI requirements:
- Enforce unique capability `id` within a skill artifact.
- `id` should be slug-like (lowercase, hyphenated) to align with export paths.
- Trim whitespace on `title`, `description`, `id`.

## Target model
Targets are UAM v1 `targets` entries:
- `targetId`: adapter id, must resolve via adapter registry
- `adapterVersion`: default `"1"`
- `options`: target-specific config (e.g. Claude skill export allowlist)

Skills UI should synchronize `Artifact.targets` with the unique set of `targetId` values in UAM targets.

## Validation constraints
Implemented via `safeParseUamV1`:
- `meta.title` required
- `scopes` are validated for duplicate ids and valid glob syntax
- `blocks` reference known scope ids
- `capabilities` entries must have `id` and optional `params`
- `targets` require `targetId`, `adapterVersion`, `options`

Recommended soft limits (UI validation only):
- max 64 skills (capabilities) per artifact
- max 4 KB per `description`
- params JSON size under 32 KB

## API contract
Skills reuse existing artifact endpoints:
- `POST /api/artifacts/save` with `uam` payload containing capabilities
- `GET /api/artifacts/:id` to read skill metadata + versions
- `GET /api/artifacts/:id/versions` for history

Client-side responsibilities:
- Build UAM v1 payloads with `capabilities` as the primary content.
- Keep `Artifact.targets` in sync with UAM `targets`.
- Use `compile` endpoint to verify export output before download.
