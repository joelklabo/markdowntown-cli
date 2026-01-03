package scan

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

type fakeInfo struct {
	mode os.FileMode
}

func (f fakeInfo) Name() string       { return "fake" }
func (f fakeInfo) Size() int64        { return 0 }
func (f fakeInfo) Mode() os.FileMode  { return f.mode }
func (f fakeInfo) ModTime() time.Time { return time.Time{} }
func (f fakeInfo) IsDir() bool        { return f.mode.IsDir() }
func (f fakeInfo) Sys() any           { return nil }

func TestDefaultGlobalRoots(t *testing.T) {
	roots := DefaultGlobalRoots()
	if runtime.GOOS == "windows" {
		if roots != nil {
			t.Fatalf("expected no global roots on windows, got %#v", roots)
		}
		return
	}
	if len(roots) == 0 {
		t.Fatalf("expected default global roots on non-windows")
	}
}

func TestIsSpecialFile(t *testing.T) {
	if isSpecialFile(nil) {
		t.Fatalf("expected nil info to be non-special")
	}
	if !isSpecialFile(fakeInfo{mode: os.ModeDevice}) {
		t.Fatalf("expected device file to be special")
	}
	if isSpecialFile(fakeInfo{mode: 0}) {
		t.Fatalf("expected regular file to be non-special")
	}
}

func TestShouldSkipGlobalPath(t *testing.T) {
	root := filepath.Join(t.TempDir(), "root")
	info := fakeInfo{mode: 0}

	if shouldSkipGlobalPath(root, root, info) {
		t.Fatalf("expected root path to be allowed")
	}

	outside := filepath.Join(root, "..", "outside")
	if !shouldSkipGlobalPath(root, outside, info) {
		t.Fatalf("expected outside path to be skipped")
	}

	sshPath := filepath.Join(root, "ssh", "config")
	if !shouldSkipGlobalPath(root, sshPath, info) {
		t.Fatalf("expected ssh path to be skipped")
	}

	if !shouldSkipGlobalPath(root, filepath.Join(root, "file"), fakeInfo{mode: os.ModeNamedPipe}) {
		t.Fatalf("expected special file to be skipped")
	}
}
