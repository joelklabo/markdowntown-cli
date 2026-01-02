package instructions

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestNormalizePathForCompare(t *testing.T) {
	normalized := normalizePathForCompare(filepath.Join("a", "..", "b", "c"))
	if normalized != "b/c" && normalized != filepath.FromSlash("b/c") {
		t.Fatalf("unexpected normalized path: %s", normalized)
	}
}

func TestEvalPathNonWindows(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("non-windows only")
	}
	path := filepath.Join("a", "b")
	if got := evalPath(path); got != path {
		t.Fatalf("expected %s, got %s", path, got)
	}
}

func TestRelativeFromFS(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "a", "b", "file.txt")
	if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(target, []byte("x"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	rel, ok := relativeFromFS(root, target)
	if !ok {
		t.Fatalf("expected relative path to resolve")
	}
	expected := filepath.Join("a", "b", "file.txt")
	if rel != expected {
		t.Fatalf("expected %s, got %s", expected, rel)
	}

	rel, ok = relativeFromFS(root, root)
	if !ok || rel != "." {
		t.Fatalf("expected '.' for root match, got %q (ok=%v)", rel, ok)
	}
}

func TestRelativeFromRoot(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "child", "file.txt")
	if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(target, []byte("x"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	rel, ok := relativeFromRoot(root, target)
	if !ok {
		t.Fatalf("expected relative path")
	}
	if rel != filepath.Join("child", "file.txt") {
		t.Fatalf("unexpected rel: %s", rel)
	}

	outside := t.TempDir()
	if rel, ok = relativeFromRoot(root, outside); ok || rel != "" {
		t.Fatalf("expected no relative path for outside target, got %q (ok=%v)", rel, ok)
	}
}
