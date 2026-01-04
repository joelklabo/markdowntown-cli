package sync

import (
	"bytes"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestPatchApply(t *testing.T) {
	repoRoot := t.TempDir()
	if err := runGitCommand(repoRoot, "init"); err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			t.Skip("git not available")
		}
		t.Fatalf("git init: %v", err)
	}
	if err := runGitCommand(repoRoot, "config", "user.email", "test@example.com"); err != nil {
		t.Fatalf("git config email: %v", err)
	}
	if err := runGitCommand(repoRoot, "config", "user.name", "Test User"); err != nil {
		t.Fatalf("git config name: %v", err)
	}

	filePath := filepath.Join(repoRoot, "README.md")
	if err := os.WriteFile(filePath, []byte("hello\n"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err := runGitCommand(repoRoot, "add", "README.md"); err != nil {
		t.Fatalf("git add: %v", err)
	}
	if err := runGitCommand(repoRoot, "commit", "-m", "init"); err != nil {
		t.Fatalf("git commit: %v", err)
	}

	if err := os.WriteFile(filePath, []byte("hello world\n"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	patchText, err := runGitCommandOutput(repoRoot, "diff")
	if err != nil {
		t.Fatalf("git diff: %v", err)
	}
	if strings.TrimSpace(patchText) == "" {
		t.Fatalf("expected non-empty patch")
	}

	if err := runGitCommand(repoRoot, "checkout", "--", "README.md"); err != nil {
		t.Fatalf("git checkout: %v", err)
	}

	patch := Patch{
		ID:          "patch-1",
		SnapshotID:  "snap-1",
		Path:        "README.md",
		PatchFormat: "unified",
		PatchBody:   patchText,
		Status:      "PROPOSED",
	}

	results, err := ApplyPatches(repoRoot, []Patch{patch}, ApplyOptions{DryRun: true})
	if err != nil {
		t.Fatalf("dry-run apply: %v", err)
	}
	if len(results) != 1 || results[0].Status != PatchDryRun {
		t.Fatalf("expected dry-run status, got %+v", results)
	}
	// #nosec G304 -- test reads temp file in repo fixture.
	content, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if string(content) != "hello\n" {
		t.Fatalf("expected file unchanged, got %q", string(content))
	}

	results, err = ApplyPatches(repoRoot, []Patch{patch}, ApplyOptions{DryRun: false})
	if err != nil {
		t.Fatalf("apply patch: %v", err)
	}
	if len(results) != 1 || results[0].Status != PatchApplied {
		t.Fatalf("expected applied status, got %+v", results)
	}
	// #nosec G304 -- test reads temp file in repo fixture.
	content, err = os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if string(content) != "hello world\n" {
		t.Fatalf("expected file updated, got %q", string(content))
	}

	state, err := loadPatchState(repoRoot)
	if err != nil {
		t.Fatalf("load patch state: %v", err)
	}
	if !state.has(patch.ID) {
		t.Fatalf("expected patch to be recorded")
	}

	results, err = ApplyPatches(repoRoot, []Patch{patch}, ApplyOptions{DryRun: false})
	if err != nil {
		t.Fatalf("re-apply patch: %v", err)
	}
	if len(results) != 1 || results[0].Status != PatchSkipped {
		t.Fatalf("expected skipped status, got %+v", results)
	}
}

func TestValidatePatchPaths(t *testing.T) {
	cases := []struct {
		name      string
		patchBody string
		wantErr   bool
	}{
		{
			name:      "valid",
			patchBody: "diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n",
			wantErr:   false,
		},
		{
			name:      "quoted",
			patchBody: "diff --git \"a/foo bar.txt\" \"b/foo bar.txt\"\n--- \"a/foo bar.txt\"\n+++ \"b/foo bar.txt\"\n",
			wantErr:   false,
		},
		{
			name:      "absolute",
			patchBody: "diff --git a//etc/passwd b//etc/passwd\n--- /etc/passwd\n+++ /etc/passwd\n",
			wantErr:   true,
		},
		{
			name:      "traversal",
			patchBody: "diff --git a/../secret.txt b/../secret.txt\n--- a/../secret.txt\n+++ b/../secret.txt\n",
			wantErr:   true,
		},
		{
			name:      "gitdir",
			patchBody: "diff --git a/.git/config b/.git/config\n--- a/.git/config\n+++ b/.git/config\n",
			wantErr:   true,
		},
		{
			name:      "gitdir-case",
			patchBody: "diff --git a/.GIT/config b/.GIT/config\n--- a/.GIT/config\n+++ b/.GIT/config\n",
			wantErr:   true,
		},
		{
			name:      "windows-backslash",
			patchBody: "diff --git a/..\\secret.txt b/..\\secret.txt\n--- a/..\\secret.txt\n+++ b/..\\secret.txt\n",
			wantErr:   true,
		},
		{
			name:      "devnull",
			patchBody: "diff --git a/new.txt b/new.txt\n--- /dev/null\n+++ b/new.txt\n",
			wantErr:   false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validatePatchPaths(tc.patchBody)
			if tc.wantErr && err == nil {
				t.Fatalf("expected error")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func runGitCommand(dir string, args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if stderr.Len() > 0 {
			return errors.New(strings.TrimSpace(stderr.String()))
		}
		return err
	}
	return nil
}

func runGitCommandOutput(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if stderr.Len() > 0 {
			return "", errors.New(strings.TrimSpace(stderr.String()))
		}
		return "", err
	}
	return stdout.String(), nil
}
