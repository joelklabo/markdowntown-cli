package scan

import (
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"

	"github.com/spf13/afero"
)

func TestParseWorkspaceFolders(t *testing.T) {
	base := t.TempDir()
	workspacePath := filepath.Join(base, "project.code-workspace")
	data := []byte(`{
  // comment
  "folders": [
    "apps/app",
    {"path": "../shared"},
  ],
}`)

	roots, err := parseWorkspaceFolders(workspacePath, data)
	if err != nil {
		t.Fatalf("parseWorkspaceFolders: %v", err)
	}

	expected := []string{
		filepath.Join(base, "apps", "app"),
		filepath.Clean(filepath.Join(base, "..", "shared")),
	}
	if !reflect.DeepEqual(roots, expected) {
		t.Fatalf("expected %v, got %v", expected, roots)
	}
}

func TestDiscoverWorkspaceRoots(t *testing.T) {
	repoRoot := t.TempDir()
	workspacePath := filepath.Join(repoRoot, "project.code-workspace")
	content := []byte(`{
  "folders": [
    {"path": "services/api"},
    {"path": "../shared"},
  ],
}`)
	if err := os.WriteFile(workspacePath, content, 0o600); err != nil {
		t.Fatalf("write workspace: %v", err)
	}

	roots, warnings := discoverWorkspaceRoots(afero.NewOsFs(), repoRoot)
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %#v", warnings)
	}

	expected := []string{
		filepath.Join(repoRoot, "services", "api"),
		filepath.Clean(filepath.Join(repoRoot, "..", "shared")),
	}
	if !reflect.DeepEqual(roots, expected) {
		t.Fatalf("expected %v, got %v", expected, roots)
	}
}

func TestResolveWorkspaceFolderHome(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	got := resolveWorkspaceFolder("", "~/project")
	expected := filepath.Join(home, "project")
	if got != expected {
		t.Fatalf("expected %s, got %s", expected, got)
	}
}

func TestResolveWorkspaceURI(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("file:// URI paths vary on Windows")
	}
	got := resolveWorkspaceURI("file:///tmp/workspace")
	expected := filepath.Clean("/tmp/workspace")
	if got != expected {
		t.Fatalf("expected %s, got %s", expected, got)
	}
}
