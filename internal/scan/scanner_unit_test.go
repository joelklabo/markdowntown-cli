package scan

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindContainingRootLongestMatch(t *testing.T) {
	base := t.TempDir()
	root := filepath.Join(base, "user")
	nested := filepath.Join(root, "nested")
	if err := os.MkdirAll(nested, 0o750); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	path := filepath.Join(nested, "file.txt")

	match := findContainingRoot(path, []string{"", root, nested})
	if match != nested {
		t.Fatalf("expected %s, got %s", nested, match)
	}
}

func TestResolveScopeAndRootFallbacks(t *testing.T) {
	base := t.TempDir()
	repoRoot := filepath.Join(base, "repo")
	userRoot := filepath.Join(base, "user")
	if err := os.MkdirAll(repoRoot, 0o750); err != nil {
		t.Fatalf("mkdir repo: %v", err)
	}
	if err := os.MkdirAll(userRoot, 0o750); err != nil {
		t.Fatalf("mkdir user: %v", err)
	}

	userFile := filepath.Join(userRoot, "settings.json")
	if err := os.WriteFile(userFile, []byte("{}"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	info, err := os.Stat(userFile)
	if err != nil {
		t.Fatalf("stat: %v", err)
	}

	scope, root := resolveScopeAndRoot(userFile, repoRoot, []string{userRoot}, info)
	if scope != "user" || root != userRoot {
		t.Fatalf("expected user scope %s, got %s %s", userRoot, scope, root)
	}

	otherDir := filepath.Join(base, "other")
	if err := os.MkdirAll(otherDir, 0o750); err != nil {
		t.Fatalf("mkdir other: %v", err)
	}
	info, err = os.Stat(otherDir)
	if err != nil {
		t.Fatalf("stat other: %v", err)
	}
	scope, root = resolveScopeAndRoot(otherDir, repoRoot, []string{userRoot}, info)
	if scope != "user" || root != otherDir {
		t.Fatalf("expected user scope %s, got %s %s", otherDir, scope, root)
	}

	outsideFile := filepath.Join(base, "outside", "file.txt")
	scope, root = resolveScopeAndRoot(outsideFile, repoRoot, []string{userRoot}, nil)
	if scope != "user" || root != filepath.Dir(outsideFile) {
		t.Fatalf("expected user scope %s, got %s %s", filepath.Dir(outsideFile), scope, root)
	}
}
