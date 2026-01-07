# Quick Fix for CLI Routes 404 Issue

## Problem
CLI API routes (`/api/cli/*`) return 404 in production but work locally.

## Root Cause
`.dockerignore` file excludes all `cli/` directories, including `apps/web/src/app/api/cli/`

## Fix Applied
Changed `.dockerignore` line 18:
```diff
- cli/
+ /cli/
```

This anchors the pattern to only exclude the root `/cli/` directory (Go CLI tool), while including `apps/web/src/app/api/cli/` (Next.js API routes).

## Deploy Instructions

### 1. Verify the Fix Locally (Optional)
```bash
./verify-docker-build.sh
```

### 2. Rebuild and Deploy to Azure
```bash
# Build new image
docker build -t <your-acr>.azurecr.io/markdowntown-web:latest .

# Push to Azure Container Registry
docker push <your-acr>.azurecr.io/markdowntown-web:latest

# Update Azure Container App
az containerapp update \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --image <your-acr>.azurecr.io/markdowntown-web:latest
```

### 3. Test in Production
```bash
# Should return JSON (not HTML 404)
curl -X POST https://markdown.town/api/cli/device/start \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Next Step: Middleware Authentication

After deploying, you may need to update `apps/web/middleware.ts` to allow CLI routes:

```typescript
const ALLOWED_PREFIXES = [
  "/api/public", 
  "/api/health", 
  "/api/auth",
  "/api/cli"  // ← Add this
];
```

Or let specific routes handle their own authentication (recommended).

## For More Details
See `CLI_ROUTES_404_ANALYSIS.md` for complete analysis.
