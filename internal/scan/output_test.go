package scan

import (
	"path/filepath"
	"testing"
)

func TestConflictWarningsSkipsMultiFileLoadBehavior(t *testing.T) {
	root := t.TempDir()
	configs := []ConfigEntry{
		{
			Path:  filepath.Join(root, ".codex", "skills", "a", "SKILL.md"),
			Scope: "user",
			Tools: []ToolEntry{{ToolID: "codex", Kind: "skills", LoadBehavior: "directory-glob"}},
		},
		{
			Path:  filepath.Join(root, ".codex", "skills", "b", "SKILL.md"),
			Scope: "user",
			Tools: []ToolEntry{{ToolID: "codex", Kind: "skills", LoadBehavior: "directory-glob"}},
		},
	}

	warnings := conflictWarnings(configs, []Root{{Scope: "user", Root: root}})
	if len(warnings) != 0 {
		t.Fatalf("expected no conflict warnings, got %d", len(warnings))
	}
}

func TestConflictWarningsReportsSingleLoadBehavior(t *testing.T) {
	root := t.TempDir()
	configs := []ConfigEntry{
		{
			Path:  filepath.Join(root, "tool", "config-a.md"),
			Scope: "repo",
			Tools: []ToolEntry{{ToolID: "tool", Kind: "config", LoadBehavior: "single"}},
		},
		{
			Path:  filepath.Join(root, "tool", "config-b.md"),
			Scope: "repo",
			Tools: []ToolEntry{{ToolID: "tool", Kind: "config", LoadBehavior: "single"}},
		},
	}

	warnings := conflictWarnings(configs, []Root{{Scope: "repo", Root: root}})
	if len(warnings) != 1 {
		t.Fatalf("expected 1 conflict warning, got %d", len(warnings))
	}
}
