#!/bin/bash
set -e

# Build CLI
cd cli
go build -o bin/markdowntown ./cmd/markdowntown
cd ..

# Initialize test repo
TEST_REPO="apps/web/.e2e-repo"
rm -rf "$TEST_REPO"
mkdir -p "$TEST_REPO"
cd "$TEST_REPO"
git init
echo "# Hello E2E" > README.md
git add README.md
git commit -m "Initial commit"

# Run upload
../../cli/bin/markdowntown upload --repo .

# Print success
echo "Upload complete"
