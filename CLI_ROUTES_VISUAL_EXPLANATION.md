# CLI Routes 404 - Visual Explanation

## Before Fix (❌ Broken)

```
.dockerignore:
  cli/     ← Matches ANY directory named "cli" at any level

Docker Build Context:
  /
  ├── cli/ ................................................ EXCLUDED ✅ (intended)
  ├── codex/ .............................................. EXCLUDED
  ├── apps/
  │   └── web/
  │       └── src/
  │           └── app/
  │               └── api/
  │                   ├── cli/ ........................... EXCLUDED ❌ (unintended!)
  │                   │   ├── device/
  │                   │   │   ├── start/route.ts
  │                   │   │   ├── poll/route.ts
  │                   │   │   └── confirm/route.ts
  │                   │   ├── upload/
  │                   │   │   ├── handshake/route.ts
  │                   │   │   ├── blob/route.ts
  │                   │   │   ├── complete/route.ts
  │                   │   │   └── cleanup/route.ts
  │                   │   ├── audit/route.ts
  │                   │   └── patches/route.ts
  │                   ├── health/ ........................ INCLUDED ✅
  │                   ├── auth/ .......................... INCLUDED ✅
  │                   └── artifacts/ ..................... INCLUDED ✅

Result in Production:
  curl https://markdown.town/api/cli/device/start
  → 404 HTML (Next.js not-found page)
  → Routes don't exist in the image!

  curl https://markdown.town/api/health
  → 200 JSON {"status":"ok"}
  → Route exists and works!
```

## After Fix (✅ Working)

```
.dockerignore:
  /cli/    ← Matches ONLY /cli/ at root level

Docker Build Context:
  /
  ├── /cli/ ............................................... EXCLUDED ✅ (intended)
  ├── /codex/ ............................................. EXCLUDED ✅ (intended)
  ├── apps/
  │   └── web/
  │       └── src/
  │           └── app/
  │               └── api/
  │                   ├── cli/ ........................... INCLUDED ✅ (fixed!)
  │                   │   ├── device/
  │                   │   │   ├── start/route.ts ......... ✅
  │                   │   │   ├── poll/route.ts .......... ✅
  │                   │   │   └── confirm/route.ts ....... ✅
  │                   │   ├── upload/
  │                   │   │   ├── handshake/route.ts ..... ✅
  │                   │   │   ├── blob/route.ts .......... ✅
  │                   │   │   ├── complete/route.ts ...... ✅
  │                   │   │   └── cleanup/route.ts ....... ✅
  │                   │   ├── audit/route.ts ............. ✅
  │                   │   └── patches/route.ts ........... ✅
  │                   ├── health/ ........................ INCLUDED ✅
  │                   ├── auth/ .......................... INCLUDED ✅
  │                   └── artifacts/ ..................... INCLUDED ✅

Result in Production:
  curl https://markdown.town/api/cli/device/start
  → 401 JSON {"error":"Unauthorized"} (middleware working!)
  → OR 200 JSON {...} (if auth bypassed)
  → Routes exist and execute!
```

## The One Character Fix

```diff
# .dockerignore (line 18)

- cli/
+ /cli/
  ^
  |
  └── Adding this slash fixes everything!
```

## Pattern Matching Rules

### Without leading `/` (matches at ANY level):
```
cli/    matches:  /cli/
                  /apps/cli/
                  /apps/web/src/app/api/cli/
                  /foo/bar/baz/cli/
```

### With leading `/` (matches at ROOT only):
```
/cli/   matches:  /cli/
        does NOT: /apps/cli/
        match:    /apps/web/src/app/api/cli/
                  /foo/bar/baz/cli/
```

## Why This Wasn't Caught Earlier

1. ✅ **Local development works** - `.dockerignore` only affects Docker builds
2. ✅ **Routes exist in git** - Files are committed and visible
3. ✅ **TypeScript compiles** - No build errors locally
4. ❌ **Only Docker builds are affected** - Pattern silently excludes during COPY
5. ❌ **Tests run locally** - Not using Docker image

## Detection Checklist

If API routes return 404 in production but work locally:

- [ ] Check `.dockerignore` for overly broad patterns
- [ ] Build Docker image locally: `docker build -t test .`
- [ ] Inspect built image: `docker run --rm test find /app -name <missing-dir>`
- [ ] Look for HTML 404 vs JSON 404 (HTML = route not found by Next.js)
- [ ] Compare working routes vs broken routes (directory names)

## Prevention

1. **Anchor patterns to root when possible:** `/cli/` not `cli/`
2. **Test Docker builds locally:** `docker build` before deploying
3. **Verify copied files:** `docker run --rm <image> ls -R /app`
4. **Monitor response types:** HTML 404 = route missing, JSON 401/404 = route exists
5. **Review .dockerignore carefully:** Every pattern can have unintended matches
