# CLI API Routes 404 Issue - Root Cause Analysis and Fix

## Problem Summary

The `/api/cli/*` API routes return 404 HTML pages in production (Azure Container Apps), while other API routes work correctly:

- ❌ `POST https://markdown.town/api/cli/device/start` → 404 HTML
- ❌ `POST https://markdown.town/api/cli/upload/handshake` → 404 HTML  
- ✅ `GET https://markdown.town/api/health` → 200 JSON
- ✅ `GET https://markdown.town/api/auth/providers` → 200 JSON

## Root Cause

**The `.dockerignore` file excludes the CLI API routes from the Docker build.**

### Location
**File:** `.dockerignore` (line 18)
```
cli/
```

### Impact
The pattern `cli/` in `.dockerignore` excludes **ALL directories named `cli`** from the Docker build context, including:

1. ✅ `/cli/` (root Go CLI tool) - **Intended exclusion**
2. ❌ `/apps/web/src/app/api/cli/` (Next.js API routes) - **Unintended exclusion**

When the Dockerfile runs:
```dockerfile
FROM deps AS builder
COPY apps/web ./apps/web  # Line 21
```

Docker excludes `apps/web/src/app/api/cli/` due to the `.dockerignore` pattern, so:
- The CLI route files never make it into the Docker image
- Next.js can't find the routes at runtime
- Returns 404 HTML (Next.js not-found page) instead of executing the route handlers

## Evidence

### 1. Routes Exist Locally
```bash
$ ls apps/web/src/app/api/cli/
audit  device  patches  upload

$ find apps/web/src/app/api/cli -name "route.ts"
apps/web/src/app/api/cli/audit/route.ts
apps/web/src/app/api/cli/device/confirm/route.ts
apps/web/src/app/api/cli/device/poll/route.ts
apps/web/src/app/api/cli/device/start/route.ts
# ... 9 routes total
```

### 2. Response Type Difference
```bash
# CLI routes return HTML 404 (Next.js not-found page)
$ curl -s https://markdown.town/api/cli/device/start | head -1
<!DOCTYPE html><html lang="en">...

# Other protected routes return JSON 401 (middleware working correctly)
$ curl -s https://markdown.town/api/artifacts/save
{"error":"Unauthorized"}
```

### 3. Dockerfile Pattern
```dockerfile
FROM deps AS builder
COPY apps/web ./apps/web          # ← This respects .dockerignore
COPY packages/engine-js ./packages/engine-js
RUN pnpm --filter ./apps/web... build
```

### 4. .dockerignore Pattern Matching
The pattern `cli/` matches any directory named `cli` at any level:
- Matches: `/cli/`, `/apps/web/src/app/api/cli/`, `/foo/cli/`
- Excludes: All of the above from Docker context

## Solution

### Fix: Anchor the Pattern to Root Only

Change line 18 in `.dockerignore` from:
```diff
- cli/
+ /cli/
```

The leading `/` anchors the pattern to the root directory only, so:
- ✅ Excludes `/cli/` (root Go CLI tool)
- ✅ Includes `/apps/web/src/app/api/cli/` (Next.js API routes)

### Complete Fixed .dockerignore
```dockerignore
.git
.github
.beads
**/.beads
**/.beads/**
.DS_Store
*.log
coverage*
**/node_modules
**/.next
**/dist
**/build
**/storybook-static
**/test-results
**/.vercel
**/.env*
markdowntown
/cli/          # ← Changed: Only exclude root cli/ directory
/codex/        # ← Also fix these for consistency
/infra/
/docs/
```

## Verification Steps

After applying the fix:

1. **Rebuild the Docker image:**
   ```bash
   docker build -t markdowntown-web .
   ```

2. **Verify CLI routes are included:**
   ```bash
   docker run --rm markdowntown-web sh -c "find /app/apps/web -name 'cli' -type d"
   # Should output: /app/apps/web/src/app/api/cli
   ```

3. **Deploy to Azure Container Apps:**
   ```bash
   az containerapp update --name <app-name> --resource-group <rg-name> --image <acr>.azurecr.io/markdowntown-web:latest
   ```

4. **Test the endpoints:**
   ```bash
   # Should return JSON with device flow data (or 401 if middleware blocks it)
   curl -X POST https://markdown.town/api/cli/device/start \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

## Additional Considerations

### Middleware Authentication

Once the routes are accessible, you may still need to update the middleware to allow CLI routes without authentication. The current middleware at `apps/web/middleware.ts` requires authentication for POST requests to `/api/cli/*`.

**Current behavior:**
```typescript
const ALLOWED_PREFIXES = ["/api/public", "/api/health", "/api/auth"];
// /api/cli/* is NOT in the bypass list
```

**If CLI routes should be public**, add to the bypass list:
```typescript
const ALLOWED_PREFIXES = [
  "/api/public", 
  "/api/health", 
  "/api/auth",
  "/api/cli"  // ← Add this
];
```

**Or** if specific CLI routes need different auth:
```typescript
const ALLOWED_PREFIXES = [
  "/api/public", 
  "/api/health", 
  "/api/auth",
  "/api/cli/device",  // Device flow routes are public
  "/api/cli/upload",  // Upload routes need tokens (handled in route)
];
```

### Route-Level Authentication

Some CLI routes like `/api/cli/device/start` should be public (for device flow), while others like `/api/cli/upload/*` should require CLI tokens. The routes already handle their own authentication:

```typescript
// apps/web/src/app/api/cli/device/start/route.ts
export async function POST(request: Request) {
  // No auth required - public device flow endpoint
  const body = await request.json();
  // ...
}

// apps/web/src/app/api/cli/upload/blob/route.ts
export async function POST(request: Request) {
  // Requires CLI token
  const tokenResult = await requireCliToken(request);
  if (!tokenResult.ok) {
    return NextResponse.json({ error: tokenResult.error }, { status: 401 });
  }
  // ...
}
```

**Recommendation:** Add `/api/cli` to `ALLOWED_PREFIXES` in middleware and let each route handle its own authentication requirements.

## Related Files

- `.dockerignore` - Root cause (line 18)
- `Dockerfile` - Copies files from context (line 21)
- `apps/web/middleware.ts` - May need updates for auth bypass
- `apps/web/src/app/api/cli/*/route.ts` - CLI API routes (9 files)

## Timeline

- **Issue:** CLI routes worked locally but returned 404 in production
- **Root Cause:** `.dockerignore` pattern excluding API routes
- **Fix:** Change `cli/` to `/cli/` in `.dockerignore`
- **Impact:** Zero downtime deployment, immediate fix after rebuild

## Summary

This was a subtle Docker build issue where an overly broad `.dockerignore` pattern excluded important application code. The fix is simple (add a `/` prefix) but the impact was significant (entire API surface area missing in production).

**Key Lessons:**
1. `.dockerignore` patterns without `/` prefix match at all directory levels
2. Test Docker builds locally before deploying to production
3. Verify copied files with `docker run --rm <image> find <path>`
4. Monitor for HTML 404s on API routes (indicates route not found, not auth failure)
