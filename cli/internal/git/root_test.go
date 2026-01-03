package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestRootMissingDir(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing")
	if _, err := Root(missing); err == nil {
		t.Fatalf("expected error for missing dir")
	}
}

func TestRootSuccess(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}

	repo := t.TempDir()
	execGit(t, repo, "init")

	subdir := filepath.Join(repo, "nested")
	if err := os.MkdirAll(subdir, 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	root, err := Root(subdir)
	if err != nil {
		t.Fatalf("Root: %v", err)
	}
	expected, err := filepath.EvalSymlinks(repo)
	if err != nil {
		t.Fatalf("eval symlinks: %v", err)
	}
	resolved, err := filepath.EvalSymlinks(root)
	if err != nil {
		t.Fatalf("eval symlinks: %v", err)
	}
	if resolved != expected {
		t.Fatalf("expected root %s, got %s", expected, resolved)
	}
}
