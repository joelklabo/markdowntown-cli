package scan

import "testing"

func TestBuildToolSummaries(t *testing.T) {
	reg := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "p1",
				ToolID:       "tool-a",
				ToolName:     "Tool A",
				Kind:         "instructions",
				Scope:        "repo",
				Paths:        []string{"AGENTS.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "auto",
				Docs:         []string{"https://example.com/a", ""},
			},
			{
				ID:           "p2",
				ToolID:       "tool-a",
				ToolName:     "Tool A",
				Kind:         "instructions",
				Scope:        "repo",
				Paths:        []string{"AGENTS.override.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "auto",
				Docs:         []string{"https://example.com/a"},
			},
			{
				ID:           "p3",
				ToolID:       "tool-b",
				ToolName:     "Tool B",
				Kind:         "config",
				Scope:        "user",
				Paths:        []string{"config.toml"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "auto",
				Docs:         []string{"https://example.com/b"},
			},
		},
	}

	summaries := BuildToolSummaries(reg)
	if len(summaries) != 2 {
		t.Fatalf("expected 2 summaries, got %d", len(summaries))
	}

	if summaries[0].ToolID != "tool-a" {
		t.Fatalf("expected tool-a first, got %s", summaries[0].ToolID)
	}
	if summaries[0].PatternCount != 2 {
		t.Fatalf("expected 2 patterns for tool-a, got %d", summaries[0].PatternCount)
	}
	if len(summaries[0].Docs) != 1 || summaries[0].Docs[0] != "https://example.com/a" {
		t.Fatalf("unexpected docs for tool-a: %v", summaries[0].Docs)
	}
}
