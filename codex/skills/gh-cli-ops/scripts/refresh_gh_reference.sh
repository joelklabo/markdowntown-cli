#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF_DIR="${SCRIPT_DIR}/../references"
OUT_FILE="${REF_DIR}/gh-help.md"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found in PATH. Install GitHub CLI and re-run." >&2
  exit 1
fi

mkdir -p "${REF_DIR}"

STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
GH_VERSION="$(GH_PAGER=cat gh --version | head -n 1 | sed -E 's/[^[:print:]\t]//g')"

COMMANDS=(
  auth
  repo
  status
  issue
  pr
  workflow
  run
  release
  secret
  variable
  api
)

{
  echo "# GitHub CLI help snapshot"
  echo
  echo "- Updated: ${STAMP}"
  echo "- Version: ${GH_VERSION}"
  echo
  echo "## gh"
  GH_PAGER=cat PAGER=cat gh help 2>/dev/null || GH_PAGER=cat PAGER=cat gh --help
  echo
  for cmd in "${COMMANDS[@]}"; do
    echo "## gh ${cmd}"
    GH_PAGER=cat PAGER=cat gh help "${cmd}" 2>/dev/null || GH_PAGER=cat PAGER=cat gh "${cmd}" --help
    echo
  done
} > "${OUT_FILE}"

printf 'Wrote %s\n' "${OUT_FILE}"
