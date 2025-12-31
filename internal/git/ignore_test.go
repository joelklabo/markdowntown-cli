package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestCheckIgnore(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}

	repo := t.TempDir()
	execGit(t, repo, "init")

	gitignore := filepath.Join(repo, ".gitignore")
	writeFile(t, gitignore, "ignored.txt\n")

	ignored := filepath.Join(repo, "ignored.txt")
	writeFile(t, ignored, "ignore me")

	tracked := filepath.Join(repo, "tracked.txt")
	writeFile(t, tracked, "keep me")

	outsideDir := t.TempDir()
	outside := filepath.Join(outsideDir, "outside.txt")
	writeFile(t, outside, "outside")

	result, err := CheckIgnore(repo, []string{ignored, tracked, outside})
	if err != nil {
		t.Fatalf("CheckIgnore: %v", err)
	}

	if !result[ignored] {
		t.Fatalf("expected ignored.txt to be ignored")
	}
	if result[tracked] {
		t.Fatalf("expected tracked.txt to be not ignored")
	}
	if result[outside] {
		t.Fatalf("expected outside.txt to be not ignored")
	}
}

func execGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, string(out))
	}
}

func writeFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
}
