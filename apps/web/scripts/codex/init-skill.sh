#!/usr/bin/env bash

set -euo pipefail

if [[ ${1:-} == "" ]]; then
  echo "Usage: scripts/codex/init-skill.sh <skill-name> [resources]" >&2
  echo "Example: scripts/codex/init-skill.sh markdowntown-backend references" >&2
  echo "Resources: comma-separated list of scripts,references,assets" >&2
  exit 1
fi

name="$1"
resources="${2:-references}"

if [[ ! "$name" =~ ^[a-z0-9-]+$ ]]; then
  echo "Skill name must be lowercase letters, digits, and hyphens (got: $name)" >&2
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
skill_dir="$root_dir/codex/skills/$name"

if [[ -e "$skill_dir" ]]; then
  echo "Skill directory already exists: $skill_dir" >&2
  exit 1
fi

mkdir -p "$skill_dir"

cat <<SKILL > "$skill_dir/SKILL.md"
---
name: $name
description: TODO: describe when to use this skill and the workflows it covers.
---

# $name

## Core workflow
1. TODO: outline the typical workflow for this skill.

## Guardrails
- TODO: add safety and consistency rules.

## References
- TODO: add key docs and codex/skills references.
SKILL

IFS=',' read -r -a resource_list <<< "$resources"
for resource in "${resource_list[@]}"; do
  case "$resource" in
    scripts|references|assets)
      mkdir -p "$skill_dir/$resource"
      ;;
    "")
      ;;
    *)
      echo "Unknown resource type: $resource" >&2
      exit 1
      ;;
  esac
done

cat <<'NOTE'
Skill scaffold created.
- Update SKILL.md frontmatter + content.
- Add references/scripts/assets as needed.
- Validate: node scripts/codex/validate-skills.mjs
- Sync: scripts/codex/sync-skills.sh --verbose
NOTE
