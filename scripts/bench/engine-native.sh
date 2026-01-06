#!/usr/bin/env bash
set -euo pipefail

# Run Go benchmarks for the engine
cd "$(dirname "$0")/../../cli"
go test -bench BenchmarkNativeEngine -run ^$ ./internal/engine
