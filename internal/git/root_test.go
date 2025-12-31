package git

import (
	"path/filepath"
	"testing"
)

func TestRootMissingDir(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing")
	if _, err := Root(missing); err == nil {
		t.Fatalf("expected error for missing dir")
	}
}
