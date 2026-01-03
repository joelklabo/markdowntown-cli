package scan

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/spf13/afero"
)

func TestParseCodexFallbackFilenames(t *testing.T) {
	data := []byte(`
# comment
project_doc_fallback_filenames = ["A.md", "B.md"]

[table]
project_doc_fallback_filenames = ["C.md"]
`)

	fallback, err := parseCodexFallbackFilenames(data)
	if err != nil {
		t.Fatalf("parseCodexFallbackFilenames: %v", err)
	}
	expected := []string{"A.md", "B.md"}
	if !reflect.DeepEqual(fallback, expected) {
		t.Fatalf("expected %v, got %v", expected, fallback)
	}
}

func TestLoadCodexFallbackFilenames(t *testing.T) {
	fs := afero.NewMemMapFs()
	t.Setenv("CODEX_HOME", "/codex")

	if err := afero.WriteFile(fs, "/codex/config.toml", []byte(`project_doc_fallback_filenames = ["INSTRUCTIONS.md"]`), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	fallback, configPath, err := loadCodexFallbackFilenames(fs)
	if err != nil {
		t.Fatalf("loadCodexFallbackFilenames: %v", err)
	}
	expectedPath := filepath.Clean("/codex/config.toml")
	if configPath != expectedPath {
		t.Fatalf("expected config path %s, got %s", expectedPath, configPath)
	}
	expected := []string{"INSTRUCTIONS.md"}
	if !reflect.DeepEqual(fallback, expected) {
		t.Fatalf("expected %v, got %v", expected, fallback)
	}
}

func TestAppendCodexFallbackPatterns(t *testing.T) {
	reg := Registry{
		Version: "test",
		Patterns: []Pattern{
			{
				ID:           "codex-agents-repo",
				ToolID:       "codex",
				ToolName:     "Codex",
				Kind:         "instructions",
				Scope:        "repo",
				Paths:        []string{"AGENTS.md"},
				Type:         "glob",
				LoadBehavior: "all-ancestors",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}
	compiled, err := CompilePatterns(reg)
	if err != nil {
		t.Fatalf("compile: %v", err)
	}

	updated, err := appendCodexFallbackPatterns(compiled, []string{"INSTRUCTIONS.md", "AGENTS.md", "INSTRUCTIONS.md"})
	if err != nil {
		t.Fatalf("appendCodexFallbackPatterns: %v", err)
	}
	if len(updated) != len(compiled)+1 {
		t.Fatalf("expected %d patterns, got %d", len(compiled)+1, len(updated))
	}

	last := updated[len(updated)-1].Pattern
	if len(last.Paths) != 1 || last.Paths[0] != "INSTRUCTIONS.md" {
		t.Fatalf("unexpected fallback paths: %v", last.Paths)
	}
	if last.ID == "" {
		t.Fatalf("expected fallback pattern id")
	}
}

func TestLoadCodexFallbackFilenamesMissingFile(t *testing.T) {
	fs := afero.NewMemMapFs()
	t.Setenv("CODEX_HOME", filepath.Join(os.TempDir(), "codex-missing"))

	fallback, _, err := loadCodexFallbackFilenames(fs)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(fallback) != 0 {
		t.Fatalf("expected no fallback filenames, got %v", fallback)
	}
}
