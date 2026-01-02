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
