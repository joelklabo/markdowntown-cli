package scan

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/spf13/afero"
)

func TestParseVSCodeInstructionsLocationsMapJSONC(t *testing.T) {
	settings := []byte(`{
// comment
"chat.instructionsFilesLocations": {
  ".github/instructions": true,
  "/abs/disabled": false,
  "http://example.com": true,
},
}`)

	paths, err := parseVSCodeInstructionsLocations(settings)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	expected := []string{".github/instructions", "http://example.com"}
	if !reflect.DeepEqual(paths, expected) {
		t.Fatalf("expected %v, got %v", expected, paths)
	}
}

func TestParseVSCodeInstructionsLocationsArrayJSONC(t *testing.T) {
	settings := []byte(`{
"chat.instructionsFilesLocations": [
  ".github/instructions",
  "/abs/path",
],
}`)

	paths, err := parseVSCodeInstructionsLocations(settings)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	expected := []string{".github/instructions", "/abs/path"}
	if !reflect.DeepEqual(paths, expected) {
		t.Fatalf("expected %v, got %v", expected, paths)
	}
}

func TestDiscoverVSCodeInstructionPathsResolvesAndDedupes(t *testing.T) {
	base := t.TempDir()
	repoRoot := filepath.Join(base, "repo")
	userRoot := filepath.Join(base, "user")
	existingRoot := filepath.Join(repoRoot, "existing")

	if err := os.MkdirAll(repoRoot, 0o750); err != nil {
		t.Fatalf("mkdir repo: %v", err)
	}
	if err := os.MkdirAll(userRoot, 0o750); err != nil {
		t.Fatalf("mkdir user: %v", err)
	}

	settingsPath := filepath.Join(userRoot, "settings.json")
	settings := fmt.Sprintf(`{"chat.instructionsFilesLocations": {"%s": true, ".github/instructions": true}}`, existingRoot)
	if err := os.WriteFile(settingsPath, []byte(settings), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}

	paths := discoverVSCodeInstructionPaths(afero.NewOsFs(), repoRoot, []string{existingRoot, userRoot})
	expected := []string{filepath.Join(repoRoot, ".github", "instructions")}
	if !reflect.DeepEqual(paths, expected) {
		t.Fatalf("expected %v, got %v", expected, paths)
	}
}
