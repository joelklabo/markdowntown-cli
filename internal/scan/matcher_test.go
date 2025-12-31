package scan

import "testing"

func TestMatcherGlobCaseInsensitive(t *testing.T) {
	reg := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "glob",
				ToolID:       "tool",
				ToolName:     "Tool",
				Kind:         "config",
				Scope:        "repo",
				Paths:        []string{"Config/Rules.MD"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}
	compiled, err := CompilePatterns(reg)
	if err != nil {
		t.Fatalf("CompilePatterns: %v", err)
	}

	matched, pattern, err := compiled[0].Match("/repo/config/rules.md", "config/rules.md")
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	if !matched {
		t.Fatalf("expected match")
	}
	if pattern != "Config/Rules.MD" {
		t.Fatalf("expected pattern match, got %s", pattern)
	}
}

func TestMatcherGlobRecursive(t *testing.T) {
	reg := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "glob",
				ToolID:       "tool",
				ToolName:     "Tool",
				Kind:         "config",
				Scope:        "repo",
				Paths:        []string{"**/*.md"},
				Type:         "glob",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}
	compiled, err := CompilePatterns(reg)
	if err != nil {
		t.Fatalf("CompilePatterns: %v", err)
	}

	matched, _, err := compiled[0].Match("/repo/dir/sub/file.MD", "dir/sub/file.MD")
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	if !matched {
		t.Fatalf("expected match")
	}
}

func TestMatcherRegexCaseInsensitive(t *testing.T) {
	reg := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "regex",
				ToolID:       "tool",
				ToolName:     "Tool",
				Kind:         "config",
				Scope:        "repo",
				Paths:        []string{"^foo/bar\\.md$"},
				Type:         "regex",
				LoadBehavior: "single",
				Application:  "automatic",
				Docs:         []string{"https://example.com"},
			},
		},
	}
	compiled, err := CompilePatterns(reg)
	if err != nil {
		t.Fatalf("CompilePatterns: %v", err)
	}

	matched, _, err := compiled[0].Match("/repo/Foo/Bar.md", "Foo/Bar.md")
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	if !matched {
		t.Fatalf("expected match")
	}
}
