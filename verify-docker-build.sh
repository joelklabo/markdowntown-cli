#!/usr/bin/env bash
# Script to verify that CLI API routes are included in the Docker build

set -e

echo "🔍 Verifying Docker build includes CLI API routes..."
echo ""

# Build a temporary image
IMAGE_NAME="markdowntown-web-test"
echo "📦 Building Docker image (this may take a few minutes)..."
docker build -t "$IMAGE_NAME" . > /dev/null 2>&1

# Check if CLI routes are present
echo ""
echo "🔎 Checking for CLI API routes in the image..."
CLI_DIR_COUNT=$(docker run --rm "$IMAGE_NAME" sh -c "find /app/apps/web -type d -name 'cli' 2>/dev/null | wc -l" | tr -d ' ')

if [ "$CLI_DIR_COUNT" -gt 0 ]; then
    echo "✅ CLI directory found in the image!"
    echo ""
    echo "📂 CLI API route structure:"
    docker run --rm "$IMAGE_NAME" sh -c "ls -R /app/apps/web/src/app/api/cli/ 2>/dev/null || echo 'Path not found'"
    
    echo ""
    echo "📝 CLI route files:"
    docker run --rm "$IMAGE_NAME" sh -c "find /app/apps/web/src/app/api/cli -name 'route.ts' 2>/dev/null | wc -l" | while read count; do
        count=$(echo "$count" | tr -d ' ')
        echo "   Found $count route.ts files"
    done
    
    echo ""
    echo "✅ SUCCESS: CLI routes are properly included in the Docker image!"
    echo "   You can now deploy this image to production."
else
    echo "❌ FAIL: CLI directory not found in the image!"
    echo "   The .dockerignore may still be excluding the CLI routes."
    exit 1
fi

# Cleanup
echo ""
echo "🧹 Cleaning up test image..."
docker rmi "$IMAGE_NAME" > /dev/null 2>&1

echo "✅ Verification complete!"
