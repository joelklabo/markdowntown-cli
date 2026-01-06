package sync

import (
	"bytes"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"markdowntown-cli/internal/git"
)

func TestPatchApply(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("line ending differences cause failures on Windows")
	}
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

func TestPatchApplyConflict(t *testing.T) {
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
	if err := os.WriteFile(filePath, []byte("alpha\nbeta\n"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err := runGitCommand(repoRoot, "add", "README.md"); err != nil {
		t.Fatalf("git add: %v", err)
	}
	if err := runGitCommand(repoRoot, "commit", "-m", "init"); err != nil {
		t.Fatalf("git commit: %v", err)
	}

	if err := os.WriteFile(filePath, []byte("alpha\nbeta\ncharlie\n"), 0o600); err != nil {
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
	if err := os.WriteFile(filePath, []byte("delta\necho\n"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	patch := Patch{
		ID:          "patch-conflict",
		SnapshotID:  "snap-1",
		Path:        "README.md",
		PatchFormat: "unified",
		PatchBody:   patchText,
		Status:      "PROPOSED",
	}

	results, err := ApplyPatches(repoRoot, []Patch{patch}, ApplyOptions{DryRun: false, Force: true})
	if err == nil {
		t.Fatalf("expected conflict error")
	}
	if !errors.Is(err, git.ErrPatchConflict) {
		t.Fatalf("expected conflict error type, got %v", err)
	}
	if len(results) != 1 || results[0].Status != PatchConflict {
		t.Fatalf("expected conflict status, got %+v", results)
	}
	// #nosec G304 -- test reads temp file in repo fixture.
	content, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if string(content) != "delta\necho\n" {
		t.Fatalf("expected file unchanged, got %q", string(content))
	}
}

func TestApplyPatchesAtomicRollback(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("line ending differences cause failures on Windows")
	}
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
	if err := os.WriteFile(filePath, []byte("line1\nline2\n"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err := runGitCommand(repoRoot, "add", "README.md"); err != nil {
		t.Fatalf("git add: %v", err)
	}
	if err := runGitCommand(repoRoot, "commit", "-m", "init"); err != nil {
		t.Fatalf("git commit: %v", err)
	}

	// Patch 1: change line 1 to "changed1"
	if err := os.WriteFile(filePath, []byte("changed1\nline2\n"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	patch1Text, _ := runGitCommandOutput(repoRoot, "diff")
	if err := runGitCommand(repoRoot, "checkout", "--", "README.md"); err != nil {
		t.Fatalf("git checkout: %v", err)
	}

	// Patch 2: change line 1 to "changed2" (conflicts with patch 1 if applied sequentially)
	if err := os.WriteFile(filePath, []byte("changed2\nline2\n"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	patch2Text, _ := runGitCommandOutput(repoRoot, "diff")
	if err := runGitCommand(repoRoot, "checkout", "--", "README.md"); err != nil {
		t.Fatalf("git checkout: %v", err)
	}

	patches := []Patch{
		{ID: "p1", SnapshotID: "s1", Path: "README.md", PatchFormat: "unified", PatchBody: patch1Text, Status: "PROPOSED"},
		{ID: "p2", SnapshotID: "s1", Path: "README.md", PatchFormat: "unified", PatchBody: patch2Text, Status: "PROPOSED"},
	}

	// Both patches apply cleanly to the base state, so DryRun should pass.
	// But P2 conflicts with P1's changes, so Real Apply should fail at P2 and rollback P1.
	results, err := ApplyPatches(repoRoot, patches, ApplyOptions{DryRun: false, Force: false})
	if err == nil {
		t.Fatalf("expected error from conflicting patches")
	}

	// Verify p1 was rolled back (file should be back to original)
	// #nosec G304 -- test reads temp file in repo fixture.
	content, _ := os.ReadFile(filePath)
	if string(content) != "line1\nline2\n" {
		t.Fatalf("expected p1 to be rolled back to 'line1\\nline2\\n', got %q", string(content))
	}

	// Verify state does not have p1 or p2
	state, _ := loadPatchState(repoRoot)
	if state.has("p1") || state.has("p2") {
		t.Fatalf("expected no patches in state")
	}

	// Verify results contain success for p1 (before rollback) and failure for p2?
	// Actually, ApplyPatches returns results processed so far.
	// If it fails at P2, it might return P1=Applied?
	// The implementation returns `results` as they were *before* the loop broke?
	// Let's check the implementation details:
	// "results" is populated in Step 1 (skipped). Step 2 (dry run) doesn't append to results if successful.
	// Step 3 (real apply) appends to results *after* successful apply?
	// No, Step 3:
	//   for _, patch := range toApply {
	//       err := apply...
	//       if err != nil { break }
	//       // DOES NOT APPEND TO RESULTS HERE
	//   }
	//   Step 4: record state and return success.
	// So if it fails in Step 3, `results` only contains Step 1 skipped items.
	// P1 is NOT in results. This is consistent with "batch failed".
	if len(results) != 0 {
		t.Fatalf("expected 0 results (since all were candidates and batch failed), got %d", len(results))
	}
}

func TestApplyPatchesSymlinkEscape(t *testing.T) {
	repoRoot := t.TempDir()
	if err := runGitCommand(repoRoot, "init"); err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			t.Skip("git not available")
		}
		t.Fatalf("git init: %v", err)
	}

	// Create a symlink pointing outside the repo
	externalDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(externalDir, "secret.txt"), []byte("secret"), 0o600); err != nil {
		t.Fatalf("write secret: %v", err)
	}

	linkPath := filepath.Join(repoRoot, "escaped_link")
	if err := os.Symlink(externalDir, linkPath); err != nil {
		t.Fatalf("create symlink: %v", err)
	}

	patchText := "diff --git a/escaped_link/secret.txt b/escaped_link/secret.txt\n--- a/escaped_link/secret.txt\n+++ b/escaped_link/secret.txt\n@@ -1 +1 @@\n-secret\n+pwned\n"

	patch := Patch{
		ID:          "p1",
		SnapshotID:  "s1",
		Path:        "escaped_link/secret.txt",
		PatchFormat: "unified",
		PatchBody:   patchText,
		Status:      "PROPOSED",
	}

	_, err := ApplyPatches(repoRoot, []Patch{patch}, ApplyOptions{DryRun: false, Force: true})
	if err == nil {
		t.Fatalf("expected error from symlink escape")
	}
	if !strings.Contains(err.Error(), "symlink resolving outside repo") {
		t.Fatalf("expected symlink escape error, got: %v", err)
	}
}

func TestValidatePatchPaths(t *testing.T) {
	repoRoot := t.TempDir()
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
			err := validatePatchPaths(repoRoot, tc.patchBody)
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
