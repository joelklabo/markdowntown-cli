package scan

import (
	"path/filepath"
	"testing"
)

func TestFilterForFile(t *testing.T) {
	wd, _ := filepath.Abs(".")
	repoRoot := filepath.Join(wd, "testrepo")

	makeEntry := func(path string, tool ToolEntry, depth int, fm map[string]any) ConfigEntry {
		return ConfigEntry{
			Path:        filepath.Join(repoRoot, path),
			Depth:       depth,
			Tools:       []ToolEntry{tool},
			Frontmatter: fm,
		}
	}

	toolNearest := ToolEntry{ToolID: "t1", Kind: "k1", LoadBehavior: "nearest-ancestor"}
	toolGlob := ToolEntry{ToolID: "t2", Kind: "k2", LoadBehavior: "directory-glob", Application: "pattern-matched", ApplicationField: "applyTo"}
	toolSingle := ToolEntry{ToolID: "t3", Kind: "k3", LoadBehavior: "single"}

	entries := []ConfigEntry{
		makeEntry("AGENTS.md", toolNearest, 0, nil),
		makeEntry("src/AGENTS.md", toolNearest, 1, nil),
		makeEntry("copilot.md", toolGlob, 0, map[string]any{"applyTo": "**/*.ts"}),
		makeEntry("other.md", toolGlob, 0, map[string]any{"applyTo": "**/*.js"}),
		makeEntry("single.md", toolSingle, 0, nil),
	}

	result := Result{Entries: entries}
	target := filepath.Join(repoRoot, "src/foo.ts")

	filtered := FilterForFile(result, target)

	if len(filtered.Entries) != 3 {
		t.Errorf("Expected 3 entries, got %d", len(filtered.Entries))
	}

	// Check nearest ancestor (src/AGENTS.md should win over AGENTS.md)
	foundSrcAgents := false
	foundRootAgents := false
	for _, e := range filtered.Entries {
		if filepath.Base(e.Path) == "AGENTS.md" {
			if e.Depth == 1 {
				foundSrcAgents = true
			} else {
				foundRootAgents = true
			}
		}
	}
	if !foundSrcAgents {
		t.Error("Expected src/AGENTS.md (depth 1) to be kept")
	}
	if foundRootAgents {
		t.Error("Expected AGENTS.md (depth 0) to be filtered out by nearest-ancestor")
	}

	// Check glob
	foundCopilot := false
	foundOther := false
	for _, e := range filtered.Entries {
		if filepath.Base(e.Path) == "copilot.md" {
			foundCopilot = true
		}
		if filepath.Base(e.Path) == "other.md" {
			foundOther = true
		}
	}
	if !foundCopilot {
		t.Error("Expected copilot.md to be kept (matches *.ts)")
	}
	if foundOther {
		t.Error("Expected other.md to be filtered out (matches *.js, target is .ts)")
	}

	// Check single
	foundSingle := false
	for _, e := range filtered.Entries {
		if filepath.Base(e.Path) == "single.md" {
			foundSingle = true
		}
	}
	if !foundSingle {
		t.Error("Expected single.md to be kept")
	}
}

func TestShadowingEntryOverridePair(t *testing.T) {
	repoRoot := t.TempDir()
	tool := ToolEntry{ToolID: "codex", Kind: "instructions", LoadBehavior: "all-ancestors"}
	base := ConfigEntry{
		Path:  filepath.Join(repoRoot, "AGENTS.md"),
		Scope: "repo",
		Tools: []ToolEntry{tool},
	}
	override := ConfigEntry{
		Path:  filepath.Join(repoRoot, "AGENTS.override.md"),
		Scope: "repo",
		Tools: []ToolEntry{tool},
	}
	result := Result{Entries: []ConfigEntry{base, override}}

	shadowed, _ := ShadowingEntry(result, base.Path)
	if shadowed == nil || filepath.Base(shadowed.Path) != "AGENTS.override.md" {
		t.Fatalf("expected AGENTS.md to be shadowed by override, got %#v", shadowed)
	}

	shadowedOverride, _ := ShadowingEntry(result, override.Path)
	if shadowedOverride != nil {
		t.Fatalf("expected override to be active, got %#v", shadowedOverride)
	}
}

func TestShadowingEntryScopePrecedence(t *testing.T) {
	repoRoot := t.TempDir()
	tool := ToolEntry{ToolID: "cursor", Kind: "instructions", LoadBehavior: "single"}
	repo := ConfigEntry{
		Path:  filepath.Join(repoRoot, ".cursorrules"),
		Scope: "repo",
		Tools: []ToolEntry{tool},
	}
	user := ConfigEntry{
		Path:  filepath.Join(repoRoot, "user", ".cursorrules"),
		Scope: "user",
		Tools: []ToolEntry{tool},
	}
	result := Result{Entries: []ConfigEntry{user, repo}}

	shadowed, _ := ShadowingEntry(result, user.Path)
	if shadowed == nil || shadowed.Path != repo.Path {
		t.Fatalf("expected user config to be shadowed by repo config, got %#v", shadowed)
	}

	shadowedRepo, _ := ShadowingEntry(result, repo.Path)
	if shadowedRepo != nil {
		t.Fatalf("expected repo config to be active, got %#v", shadowedRepo)
	}
}

func TestShadowingEntrySkipsMultiFile(t *testing.T) {
	repoRoot := t.TempDir()
	tool := ToolEntry{ToolID: "codex", Kind: "instructions", LoadBehavior: "all-ancestors"}
	repo := ConfigEntry{
		Path:  filepath.Join(repoRoot, "AGENTS.md"),
		Scope: "repo",
		Tools: []ToolEntry{tool},
	}
	user := ConfigEntry{
		Path:  filepath.Join(repoRoot, "user", "AGENTS.md"),
		Scope: "user",
		Tools: []ToolEntry{tool},
	}
	result := Result{Entries: []ConfigEntry{repo, user}}

	shadowed, _ := ShadowingEntry(result, user.Path)
	if shadowed != nil {
		t.Fatalf("expected multi-file config to remain active, got %#v", shadowed)
	}
}
