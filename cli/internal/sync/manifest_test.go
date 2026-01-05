package sync

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func TestManifestBuild(t *testing.T) {
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)

	fileOne := filepath.Join(repoRoot, "README.md")
	fileTwo := filepath.Join(repoRoot, "dir", "nested.txt")

	writeFile(t, fileOne, "hello")
	writeFile(t, fileTwo, "world")

	mtime := time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)
	if err := os.Chtimes(fileOne, mtime, mtime); err != nil {
		t.Fatalf("chtimes fileOne: %v", err)
	}
	if err := os.Chtimes(fileTwo, mtime, mtime); err != nil {
		t.Fatalf("chtimes fileTwo: %v", err)
	}

	manifest, preflight, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}

	if preflight.FileCount != 2 {
		t.Fatalf("expected 2 files, got %d", preflight.FileCount)
	}
	if preflight.TotalBytes != int64(len("hello")+len("world")) {
		t.Fatalf("unexpected total bytes: %d", preflight.TotalBytes)
	}
	if preflight.MaxFileBytes != int64(len("world")) {
		t.Fatalf("unexpected max file bytes: %d", preflight.MaxFileBytes)
	}

	if len(manifest.Entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(manifest.Entries))
	}
	if manifest.Entries[0].Path != "README.md" || manifest.Entries[1].Path != "dir/nested.txt" {
		t.Fatalf("entries not sorted: %v", []string{manifest.Entries[0].Path, manifest.Entries[1].Path})
	}

	assertEntry(t, manifest.Entries[0], fileOne, "README.md", "hello", mtime)
	assertEntry(t, manifest.Entries[1], fileTwo, "dir/nested.txt", "world", mtime)

	payload, err := json.Marshal(manifest.Entries)
	if err != nil {
		t.Fatalf("marshal manifest entries: %v", err)
	}
	checksum := sha256.Sum256(payload)
	if manifest.Hash != hex.EncodeToString(checksum[:]) {
		t.Fatalf("unexpected manifest hash: %s", manifest.Hash)
	}
}

func TestManifestSkipsGitIgnored(t *testing.T) {
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)

	writeFile(t, filepath.Join(repoRoot, ".gitignore"), "ignored.txt\n")
	gitCommitAll(t, repoRoot, "Add gitignore")

	writeFile(t, filepath.Join(repoRoot, "ignored.txt"), "skip")
	writeFile(t, filepath.Join(repoRoot, "keep.txt"), "keep")

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}

	if hasEntry(manifest.Entries, "ignored.txt") {
		t.Fatalf("expected ignored.txt to be excluded")
	}
	if !hasEntry(manifest.Entries, "keep.txt") {
		t.Fatalf("expected keep.txt to be included")
	}
}

func TestManifestPreflightLimits(t *testing.T) {
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)

	writeFile(t, filepath.Join(repoRoot, "one.txt"), "one")
	writeFile(t, filepath.Join(repoRoot, "two.txt"), "two")

	_, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot, MaxFiles: 1})
	assertPreflightError(t, err, PreflightMaxFiles)

	_, _, err = BuildManifest(ManifestOptions{RepoRoot: repoRoot, MaxTotalBytes: 1})
	assertPreflightError(t, err, PreflightMaxTotalBytes)

	_, _, err = BuildManifest(ManifestOptions{RepoRoot: repoRoot, MaxFileBytes: 1})
	assertPreflightError(t, err, PreflightMaxFileBytes)
}

func assertEntry(t *testing.T, entry ManifestEntry, path string, relPath string, content string, mtime time.Time) {
	t.Helper()

	if entry.Path != relPath {
		t.Fatalf("unexpected path: %s", entry.Path)
	}

	checksum := sha256.Sum256([]byte(content))
	if entry.BlobHash != hex.EncodeToString(checksum[:]) {
		t.Fatalf("unexpected blob hash for %s: %s", relPath, entry.BlobHash)
	}

	if entry.Size != int64(len(content)) {
		t.Fatalf("unexpected size for %s: %d", relPath, entry.Size)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat %s: %v", relPath, err)
	}
	if entry.Mode != int64(info.Mode().Perm()) {
		t.Fatalf("unexpected mode for %s: %d", relPath, entry.Mode)
	}

	if entry.Mtime != mtime.UnixMilli() {
		t.Fatalf("unexpected mtime for %s: %d", relPath, entry.Mtime)
	}
}

func hasEntry(entries []ManifestEntry, path string) bool {
	for _, entry := range entries {
		if entry.Path == path {
			return true
		}
	}
	return false
}

func assertPreflightError(t *testing.T, err error, kind PreflightErrorKind) {
	t.Helper()

	if err == nil {
		t.Fatalf("expected preflight error")
	}
	var perr *PreflightError
	if !errors.As(err, &perr) {
		t.Fatalf("expected preflight error, got %v", err)
	}
	if perr.Kind != kind {
		t.Fatalf("expected %s, got %s", kind, perr.Kind)
	}
}

func initGitRepo(t *testing.T, dir string) {
	t.Helper()
	cmd := exec.Command("git", "init")
	cmd.Dir = dir
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git init failed: %v: %s", err, string(output))
	}
}

func writeFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
}

func TestManifestCanonicalHash(t *testing.T) {
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)

	fileOne := filepath.Join(repoRoot, "README.md")
	fileTwo := filepath.Join(repoRoot, "dir", "nested.txt")

	writeFile(t, fileOne, "hello")
	writeFile(t, fileTwo, "world")

	mtime := time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)
	if err := os.Chtimes(fileOne, mtime, mtime); err != nil {
		t.Fatalf("chtimes fileOne: %v", err)
	}
	if err := os.Chtimes(fileTwo, mtime, mtime); err != nil {
		t.Fatalf("chtimes fileTwo: %v", err)
	}

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}

	expectedEntries := []ManifestEntry{
		{
			Path:     "README.md",
			BlobHash: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
			Size:     5,
			Mode:     0o600,
			Mtime:    mtime.UnixMilli(),
		},
		{
			Path:     "dir/nested.txt",
			BlobHash: "486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7",
			Size:     5,
			Mode:     0o600,
			Mtime:    mtime.UnixMilli(),
		},
	}

	payload, err := json.Marshal(expectedEntries)
	if err != nil {
		t.Fatalf("marshal expected entries: %v", err)
	}
	checksum := sha256.Sum256(payload)
	goldenHash := hex.EncodeToString(checksum[:])

	if manifest.Hash != goldenHash {
		t.Fatalf("canonical hash mismatch:\n  got:      %s\n  expected: %s\n\nThis indicates the manifest serialization has changed. Update the golden hash if intentional.",
			manifest.Hash, goldenHash)
	}

	if len(manifest.Entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(manifest.Entries))
	}

	for i, entry := range manifest.Entries {
		if entry.Path != expectedEntries[i].Path {
			t.Fatalf("entry %d path mismatch: got %s, expected %s", i, entry.Path, expectedEntries[i].Path)
		}
		if entry.BlobHash != expectedEntries[i].BlobHash {
			t.Fatalf("entry %d blobHash mismatch: got %s, expected %s", i, entry.BlobHash, expectedEntries[i].BlobHash)
		}
		if entry.Size != expectedEntries[i].Size {
			t.Fatalf("entry %d size mismatch: got %d, expected %d", i, entry.Size, expectedEntries[i].Size)
		}
		if entry.Mode != expectedEntries[i].Mode {
			t.Fatalf("entry %d mode mismatch: got %d, expected %d", i, entry.Mode, expectedEntries[i].Mode)
		}
		if entry.Mtime != expectedEntries[i].Mtime {
			t.Fatalf("entry %d mtime mismatch: got %d, expected %d", i, entry.Mtime, expectedEntries[i].Mtime)
		}
	}
}

func TestManifestEmptyHash(t *testing.T) {
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}

	if len(manifest.Entries) != 0 {
		t.Fatalf("expected empty manifest, got %d entries", len(manifest.Entries))
	}

	goldenEmptyHash := "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
	if manifest.Hash != goldenEmptyHash {
		t.Fatalf("empty manifest hash mismatch:\n  got:      %s\n  expected: %s", manifest.Hash, goldenEmptyHash)
	}
}

func TestManifestNestedRepoRoot(t *testing.T) {
	repoRoot := t.TempDir()
	initGitRepo(t, repoRoot)

	writeFile(t, filepath.Join(repoRoot, ".gitignore"), "ignored.txt\n")
	gitCommitAll(t, repoRoot, "Add gitignore")

	writeFile(t, filepath.Join(repoRoot, "ignored.txt"), "skip")
	writeFile(t, filepath.Join(repoRoot, "keep.txt"), "keep")

	subdir := filepath.Join(repoRoot, "subdir")
	writeFile(t, filepath.Join(subdir, "nested.txt"), "nested")
	writeFile(t, filepath.Join(subdir, "ignored.txt"), "also-skip")

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: subdir})
	if err != nil {
		t.Fatalf("build manifest from subdir: %v", err)
	}

	if !hasEntry(manifest.Entries, "nested.txt") {
		t.Fatalf("expected nested.txt to be included")
	}

	if hasEntry(manifest.Entries, "ignored.txt") {
		t.Fatalf("expected ignored.txt to be excluded by parent .gitignore")
	}
}

func TestManifestNonGitDirectory(t *testing.T) {
	repoRoot := t.TempDir()

	writeFile(t, filepath.Join(repoRoot, "file.txt"), "content")

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: repoRoot})
	if err != nil {
		t.Fatalf("build manifest in non-git dir: %v", err)
	}

	if !hasEntry(manifest.Entries, "file.txt") {
		t.Fatalf("expected file.txt to be included (no gitignore in non-git dir)")
	}
}

func TestManifestGitWorktree(t *testing.T) {
	mainRepo := t.TempDir()
	initGitRepo(t, mainRepo)

	writeFile(t, filepath.Join(mainRepo, ".gitignore"), "ignored.txt\n")
	writeFile(t, filepath.Join(mainRepo, "main.txt"), "main")
	gitCommitAll(t, mainRepo, "initial")

	worktreeDir := t.TempDir()
	// #nosec G204 -- git command with controlled arguments in test
	cmd := exec.Command("git", "worktree", "add", worktreeDir, "HEAD")
	cmd.Dir = mainRepo
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git worktree add failed: %v: %s", err, string(output))
	}

	writeFile(t, filepath.Join(worktreeDir, "ignored.txt"), "skip")
	writeFile(t, filepath.Join(worktreeDir, "keep.txt"), "keep")

	manifest, _, err := BuildManifest(ManifestOptions{RepoRoot: worktreeDir})
	if err != nil {
		t.Fatalf("build manifest from worktree: %v", err)
	}

	if hasEntry(manifest.Entries, "ignored.txt") {
		t.Fatalf("expected ignored.txt to be excluded in worktree")
	}
	if !hasEntry(manifest.Entries, "keep.txt") {
		t.Fatalf("expected keep.txt to be included in worktree")
	}
}

func gitCommitAll(t *testing.T, dir string, message string) {
	t.Helper()

	cmd := exec.Command("git", "add", ".")
	cmd.Dir = dir
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git add failed: %v: %s", err, string(output))
	}

	cmd = exec.Command("git", "commit", "-m", message)
	cmd.Dir = dir
	cmd.Env = []string{
		"GIT_AUTHOR_NAME=test",
		"GIT_AUTHOR_EMAIL=test@example.com",
		"GIT_COMMITTER_NAME=test",
		"GIT_COMMITTER_EMAIL=test@example.com",
		"PATH=" + os.Getenv("PATH"),
		"HOME=" + os.Getenv("HOME"),
	}
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git commit failed: %v: %s", err, string(output))
	}
}
