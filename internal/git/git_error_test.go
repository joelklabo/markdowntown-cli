package git

import (
	"errors"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestCommandErrorFormatting(t *testing.T) {
	cause := errors.New("boom")
	withStderr := &commandError{
		command:  "status",
		exitCode: 2,
		stderr:   "bad news",
		cause:    cause,
	}
	if !strings.Contains(withStderr.Error(), "bad news") {
		t.Fatalf("expected stderr in error, got %q", withStderr.Error())
	}
	if !errors.Is(withStderr, cause) {
		t.Fatalf("expected unwrap to match cause")
	}

	withoutStderr := &commandError{
		command:  "status",
		exitCode: 1,
		cause:    cause,
	}
	if strings.Contains(withoutStderr.Error(), "bad news") {
		t.Fatalf("unexpected stderr in error: %q", withoutStderr.Error())
	}
	if !strings.Contains(withoutStderr.Error(), "git status failed with exit code 1") {
		t.Fatalf("unexpected error format: %q", withoutStderr.Error())
	}
}

func TestRunGitNotFound(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	if _, err := runGit(t.TempDir(), nil, "status"); !errors.Is(err, ErrGitNotFound) {
		t.Fatalf("expected ErrGitNotFound, got %v", err)
	}
}

func TestCheckIgnoreNoIgnoredFiles(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}

	repo := t.TempDir()
	execGit(t, repo, "init")

	tracked := filepath.Join(repo, "tracked.txt")
	writeFile(t, tracked, "keep me")

	result, err := CheckIgnore(repo, []string{tracked})
	if err != nil {
		t.Fatalf("CheckIgnore: %v", err)
	}
	if result[tracked] {
		t.Fatalf("expected tracked.txt to be not ignored")
	}
}

func TestTrimRepoPrefixRoot(t *testing.T) {
	repo := t.TempDir()
	rel, ok := trimRepoPrefix(repo, repo)
	if !ok || rel != "." {
		t.Fatalf("expected rel '.' for repo root, got %q (ok=%v)", rel, ok)
	}
}
