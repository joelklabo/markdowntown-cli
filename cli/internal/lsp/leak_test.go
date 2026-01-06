package lsp

import (
	"testing"

	"go.uber.org/goleak"
)

func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m, goleakOptions()...)
}

// goleakOptions returns goleak configuration for LSP tests.
//
// Goleak helps detect goroutine leaks by verifying that all goroutines started
// during a test are properly terminated. This is critical for LSP servers because
// leaked goroutines can accumulate over the server's lifetime, leading to:
// - Memory leaks from goroutine stacks and captured variables
// - Resource exhaustion from file descriptors or network connections
// - Unpredictable behavior from background work continuing after shutdown
//
// Ignore list rationale:
//
//  1. IgnoreCurrent(): Ignores goroutines that existed before the test started.
//     These include the test runner, runtime background workers (GC, finalizers),
//     and any goroutines from TestMain or package init functions. Without this,
//     goleak would report false positives for stdlib and test infrastructure.
//
//  2. BufferedWriter.run: The glsp/commonlog library creates a shared buffered
//     writer goroutine for LSP logging. This goroutine is intentionally long-lived
//     (process lifetime) and is reused across all tests. It's not a leak because:
//     - It's created once per test process, not per test
//     - It's cleaned up when the process exits
//     - It doesn't accumulate resources over time
//     See: github.com/tliron/go-kutil/util.BufferedWriter
func goleakOptions() []goleak.Option {
	return []goleak.Option{
		goleak.IgnoreCurrent(),
		goleak.IgnoreTopFunction("github.com/tliron/go-kutil/util.(*BufferedWriter).run"),
	}
}
