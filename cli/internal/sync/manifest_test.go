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
