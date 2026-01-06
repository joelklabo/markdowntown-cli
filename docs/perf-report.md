# Performance Report

This document captures baseline performance metrics for the `markdowntown` engine, comparing the native Go implementation against the WASM build running in Node.js.

## Benchmarks (2026-01-06)

### Native Go Engine

Benchmarks run with `go test -bench . -run ^$ ./internal/engine`.

| Benchmark                             | Time/Op         |
| ------------------------------------- | --------------- |
| `BenchmarkNativeEngineScanAudit`      | `44,099 ns/op`  |
| `BenchmarkNativeEngineRunRules`       | `489.2 ns/op`   |
| `BenchmarkNativeEngineRunWithContext` | `281.3 ns/op`   |
| `BenchmarkNativeEngineSuggest`        | `2,782 ns/op`   |

### WASM Engine (Node.js)

Benchmarks run with `node scripts/bench/engine-wasm.ts` over 100 iterations.

| Benchmark         | Average Time/Call |
| ----------------- | ----------------- |
| `Scan/Audit`      | `1.31 ms`         |
| `Suggest`         | `52.46 ms`        |

## Analysis

- The native Go engine is significantly faster for all operations, as expected.
- The WASM `suggest` performance is an order of magnitude slower than `scan/audit`, likely due to the additional overhead of the suggest pipeline (normalization, claim extraction, conflict detection) and JSON serialization/deserialization between JS and Go.
- The native `Suggest` benchmark, even after being updated to include more of the pipeline, is still much faster (`2782 ns/op` or `0.002782 ms`) than the WASM `Suggest` (`52.46 ms`). The remaining difference is likely due to the WASM overhead itself, including the cost of calling into and out of the WASM module and any inefficiencies in the `syscall/js` layer.
