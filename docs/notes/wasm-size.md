# WASM Size Optimization Analysis

**Date:** 2026-01-05  
**Go Version:** 1.25.x  
**Target:** `cli/cmd/engine-wasm`

## Size Measurements

### Baseline Build
```bash
GOOS=js GOARCH=wasm CGO_ENABLED=0 go build -trimpath -buildvcs=false \
  -o markdowntown_engine.wasm ./cmd/engine-wasm
```

**Results:**
- Raw WASM: **7.25 MB** (7,424 KB)
- Gzip -9: **2.0 MB**
- Brotli -9: **1.7 MB**

### Stripped Build (ldflags "-s -w")
```bash
GOOS=js GOARCH=wasm CGO_ENABLED=0 go build -trimpath -buildvcs=false \
  -ldflags="-s -w" -o markdowntown_engine.wasm ./cmd/engine-wasm
```

**Results:**
- Raw WASM: **6.9 MB** (7,065 KB)
- Gzip -9: **2.0 MB**  
- Brotli -9: **1.6 MB**

**Size reduction:** 5% raw, ~6% compressed

### TinyGo
**Status:** Not evaluated (TinyGo not installed)

**Risks:**
- Limited `syscall/js` support
- JSON decoding libraries may not work
- Requires testing all registry parsing code
- `wasm_exec.js` version mismatch potential

**Recommendation:** Defer TinyGo investigation until standard Go optimizations are exhausted.

## Compression Strategy

### Best Option: Brotli
- **Level 9**: 1.6 MB (with `-s -w` flags)
- Browser support: All modern browsers (2017+)
- Build time: Acceptable (~2s for compression)

### Fallback: Gzip
- **Level 9**: 2.0 MB
- Universal browser support
- Faster compression

## Size Budget

### Recommended Budget
- **Raw WASM:** < 8 MB (allow for growth)
- **Brotli compressed:** < 2 MB (critical threshold)
- **Network transfer:** < 2 MB (with compression)

### Rationale
- 2 MB download is acceptable for first load (one-time cost)
- Browser caching amortizes cost across sessions
- Equivalent to ~500 KB of JavaScript (3-4x compression typical)
- Competitive with large JS frameworks (React ~140 KB, Angular ~500 KB)

### Monitoring
Track WASM size in CI:
```bash
# Build and check size
pnpm wasm:build
SIZE_KB=$(wc -c < apps/web/public/engine/markdowntown_engine.wasm | awk '{print int($1/1024)}')
if [ "$SIZE_KB" -gt 8192 ]; then
  echo "WASM size exceeded budget: ${SIZE_KB} KB > 8192 KB"
  exit 1
fi
```

## Build Configuration

### Recommended Flags
```bash
GOOS=js GOARCH=wasm CGO_ENABLED=0 go build \
  -trimpath \
  -buildvcs=false \
  -ldflags="-s -w" \
  -o markdowntown_engine.wasm \
  ./cmd/engine-wasm
```

**Flags explained:**
- `-trimpath`: Remove absolute file paths (security + size)
- `-buildvcs=false`: No VCS info in binary
- `-ldflags="-s -w"`: Strip symbols + DWARF debug info
- `CGO_ENABLED=0`: Pure Go (required for WASM)

### NOT Recommended
- **TinyGo:** Compatibility risks outweigh size savings (defer to future)
- **UPX compression:** Not applicable to WASM
- **`-ldflags="-w"` only:** Keep `-s` too (removes symbol table)

## Deployment Strategy

### Static Hosting
Serve pre-compressed `.wasm.br` files with:
```
Content-Type: application/wasm
Content-Encoding: br
Cache-Control: public, max-age=31536000, immutable
```

### Next.js Configuration
```typescript
// next.config.ts
headers: async () => [{
  source: '/engine/:file*.wasm',
  headers: [
    { key: 'Content-Type', value: 'application/wasm' },
    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
  ],
}]
```

### CDN
Consider serving from CDN with Brotli support:
- Cloudflare (auto Brotli)
- AWS CloudFront (enable Brotli compression)
- Fastly (Brotli enabled by default)

## Performance Impact

### Load Time (estimated)
- **Cable (100 Mbps):** 128 ms
- **4G (25 Mbps):** 512 ms
- **3G (2 Mbps):** 8s

### Mitigation
- Lazy load WASM (only when needed)
- Show loading indicator
- Prefetch on route hover (predictive loading)
- Service worker caching (instant repeat loads)

## Future Optimizations

1. **Code splitting:** Separate audit/suggest into distinct WASM modules
2. **Tree shaking:** Remove unused registry rules at build time
3. **Custom allocator:** Smaller memory allocator for WASM
4. **TinyGo evaluation:** Once syscall/js compatibility confirmed
5. **WASM strip tools:** wabt's `wasm-opt` for additional size reduction

## Action Items

- [x] Measure baseline sizes
- [x] Test ldflags optimization
- [x] Document size budget
- [x] Update build script with optimized flags
- [ ] Add CI size check (warning at 7 MB, fail at 8 MB)
- [ ] Implement Brotli pre-compression in build pipeline
- [ ] Add WASM size to release notes

## References

- [Go WASM guide](https://github.com/golang/go/wiki/WebAssembly)
- [TinyGo WASM support](https://tinygo.org/docs/guides/webassembly/)
- [wabt wasm-opt](https://github.com/WebAssembly/wabt)
- [Brotli vs Gzip benchmarks](https://cran.r-project.org/web/packages/brotli/vignettes/brotli-2015-09-22.pdf)
