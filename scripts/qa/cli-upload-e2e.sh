#!/bin/bash
set -e

# Usage: ./cli-upload-e2e.sh <repo-path> <base-url>
REPO_PATH=$1
BASE_URL=$2

if [ -z "$REPO_PATH" ] || [ -z "$BASE_URL" ]; then
  echo "Usage: $0 <repo-path> <base-url>"
  exit 1
fi

# Locate CLI binary
CLI_BIN="$(git rev-parse --show-toplevel)/cli/bin/markdowntown"

if [ ! -f "$CLI_BIN" ]; then
  echo "CLI binary not found at $CLI_BIN. Please run 'make build' in cli directory."
  exit 1
fi

# Run upload
# We assume the user is already logged in or token is configured.
# We capture stdout to extract the URL.
OUTPUT=$("$CLI_BIN" upload --repo "$REPO_PATH" --base-url "$BASE_URL" --project "e2e-auto" --quiet)
echo "$OUTPUT"
