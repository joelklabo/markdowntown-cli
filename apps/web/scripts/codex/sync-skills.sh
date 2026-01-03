#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="$ROOT_DIR/codex/skills"
DEST_DIR="${CODEX_HOME:-$HOME/.codex}/skills"

DRY_RUN=0
VERBOSE=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    --verbose)
      VERBOSE=1
      ;;
    --help)
      echo "Usage: scripts/codex/sync-skills.sh [--dry-run] [--verbose]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

if [[ ! -d "$SRC_DIR" ]]; then
  echo "No skills to sync (missing $SRC_DIR)"
  exit 0
fi

mkdir -p "$DEST_DIR"

for skill_dir in "$SRC_DIR"/*; do
  [[ -d "$skill_dir" ]] || continue
  name="$(basename "$skill_dir")"
  target="$DEST_DIR/$name"

  if [[ "$VERBOSE" -eq 1 ]]; then
    echo "Syncing $name -> $target"
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] Would replace $target"
    continue
  fi

  rm -rf "$target"
  cp -a "$skill_dir" "$target"
done

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry-run complete. No changes written to $DEST_DIR."
else
  echo "Synced skills to $DEST_DIR"
fi
