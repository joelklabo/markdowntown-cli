package lsp

import (
	"testing"

	"go.uber.org/goleak"
)

func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m, goleakOptions()...)
}

func goleakOptions() []goleak.Option {
	return []goleak.Option{
		// Ignore goroutines that exist before tests start (stdlib/test runner).
		goleak.IgnoreCurrent(),
		// commonlog/go-kutil uses a shared buffered writer goroutine that lives for the test process lifetime.
		goleak.IgnoreTopFunction("github.com/tliron/go-kutil/util.(*BufferedWriter).run"),
	}
}
