package lsp

import (
	"os"
	"testing"
	"time"

	"go.uber.org/goleak"
)

// TestLeakDetectionNegative demonstrates that goleak correctly catches leaked goroutines.
// This test is skipped by default to avoid flaking CI. To run it:
//
//	MARKDOWNTOWN_TEST_LEAK_NEGATIVE=1 go test ./internal/lsp -run LeakDetectionNegative -v
//
// Expected behavior: This test should FAIL with a goleak error reporting the leaked goroutine.
// If this test passes, goleak is not working correctly.
func TestLeakDetectionNegative(t *testing.T) {
	if os.Getenv("MARKDOWNTOWN_TEST_LEAK_NEGATIVE") != "1" {
		t.Skip("Skipping negative leak test (set MARKDOWNTOWN_TEST_LEAK_NEGATIVE=1 to run)")
	}

	// Explicitly verify no leaks at test end (this will fail due to the leak below)
	defer goleak.VerifyNone(t, goleakOptions()...)

	// Intentionally leak a goroutine to demonstrate goleak detection
	leaked := make(chan struct{})
	go func() {
		<-leaked // Block forever, never close the channel
	}()

	// Give the goroutine time to start
	time.Sleep(10 * time.Millisecond)

	// Test exits without closing the channel, leaving the goroutine leaked.
	// Goleak should detect this and fail the test with a message like:
	// "found unexpected goroutines: [Goroutine X in state chan receive, with...]"
}
