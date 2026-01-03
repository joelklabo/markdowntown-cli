package instructions

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func assertSamePath(t *testing.T, got, want string) {
	t.Helper()
	if !samePath(got, want) {
		t.Fatalf("expected %s, got %s", want, got)
	}
}

func samePath(a, b string) bool {
	if a == b {
		return true
	}
	aClean := filepath.Clean(a)
	bClean := filepath.Clean(b)
	if runtime.GOOS == "windows" {
		aClean = strings.ToLower(aClean)
		bClean = strings.ToLower(bClean)
	}
	if aClean == bClean {
		return true
	}
	infoA, errA := os.Stat(a)
	infoB, errB := os.Stat(b)
	if errA == nil && errB == nil {
		return os.SameFile(infoA, infoB)
	}
	return false
}

func containsSamePath(paths []string, want string) bool {
	for _, path := range paths {
		if samePath(path, want) {
			return true
		}
	}
	return false
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
}
