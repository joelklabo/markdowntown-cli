package scan

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestCloneToTemp(t *testing.T) {
	// 1. Setup a local "remote" git repo to clone from
	originDir, err := os.MkdirTemp("", "test-origin-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(originDir)
	})

	// Initialize git repo
	runGit(t, originDir, "init")
	runGit(t, originDir, "config", "user.email", "you@example.com")
	runGit(t, originDir, "config", "user.name", "Your Name")
	runGit(t, originDir, "checkout", "-b", "main")

	// Create a file and commit it
	readmePath := filepath.Join(originDir, "README.md")
	if err := os.WriteFile(readmePath, []byte("# Hello"), 0600); err != nil {
		t.Fatal(err)
	}
	runGit(t, originDir, "add", ".")
	runGit(t, originDir, "commit", "-m", "Initial commit")

	// 2. Test Cloning
	t.Run("Basic Clone", func(t *testing.T) {
		clonedDir, cleanup, err := CloneToTemp(originDir, "")
		if err != nil {
			t.Fatalf("CloneToTemp failed: %v", err)
		}
		defer cleanup()

		// Verify file exists
		if _, err := os.Stat(filepath.Join(clonedDir, "README.md")); os.IsNotExist(err) {
			t.Error("README.md not found in cloned directory")
		}
	})

	t.Run("Clone with Branch", func(t *testing.T) {
		// Create a new branch in origin
		runGit(t, originDir, "checkout", "-b", "feature")
		if err := os.WriteFile(filepath.Join(originDir, "feature.txt"), []byte("feat"), 0600); err != nil {
			t.Fatal(err)
		}
		runGit(t, originDir, "add", ".")
		runGit(t, originDir, "commit", "-m", "Add feature")

		// Clone specific branch
		clonedDir, cleanup, err := CloneToTemp(originDir, "feature")
		if err != nil {
			t.Fatalf("CloneToTemp failed: %v", err)
		}
		defer cleanup()

		// Verify feature file exists
		if _, err := os.Stat(filepath.Join(clonedDir, "feature.txt")); os.IsNotExist(err) {
			t.Error("feature.txt not found in cloned directory")
		}
	})

	t.Run("Invalid URL", func(t *testing.T) {
		_, cleanup, err := CloneToTemp("/invalid/path/to/repo", "")
		if err == nil {
			cleanup()
			t.Error("Expected error for invalid repo, got nil")
		}
	})
}

func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\nOutput: %s", args, err, out)
	}
}
