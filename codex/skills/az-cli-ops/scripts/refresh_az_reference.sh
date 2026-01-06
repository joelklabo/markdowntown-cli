#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF_DIR="${SCRIPT_DIR}/../references"
OUT_FILE="${REF_DIR}/az-help.md"

if ! command -v az >/dev/null 2>&1; then
  echo "az CLI not found in PATH. Install Azure CLI and re-run." >&2
  exit 1
fi

mkdir -p "${REF_DIR}"

STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
AZ_VERSION="$(az version 2>/dev/null | head -n 1 | sed -E 's/[^[:print:]\t]//g')"

COMMANDS=(
  account
  group
  resource
  deployment
  keyvault
  appservice
  webapp
  containerapp
  acr
  role
  monitor
)

{
  echo "# Azure CLI help snapshot"
  echo
  echo "- Updated: ${STAMP}"
  echo "- Version: ${AZ_VERSION}"
  echo
  echo "## az"
  az --help
  echo
  for cmd in "${COMMANDS[@]}"; do
    echo "## az ${cmd}"
    az "${cmd}" --help 2>/dev/null || echo "(az ${cmd} help unavailable - missing extension or command)"
    echo
  done
  echo "## az deployment group"
  az deployment group --help 2>/dev/null || true
  echo
  echo "## az deployment sub"
  az deployment sub --help 2>/dev/null || true
  echo
} > "${OUT_FILE}"

printf 'Wrote %s\n' "${OUT_FILE}"
