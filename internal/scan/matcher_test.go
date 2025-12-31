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

func TestMatcherGlobXDGConfigExpansion(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", "/tmp/xdg config")
	reg := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "xdg",
				ToolID:       "tool",
				ToolName:     "Tool",
				Kind:         "config",
				Scope:        "user",
				Paths:        []string{"$XDG_CONFIG_HOME/copilot/config.json", "${XDG_CONFIG_HOME}/copilot/agents/*.md"},
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

	matched, _, err := compiled[0].Match("/tmp/xdg config/copilot/config.json", "copilot/config.json")
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	if !matched {
		t.Fatalf("expected match for expanded $XDG_CONFIG_HOME")
	}

	matched, _, err = compiled[0].Match("/tmp/xdg config/copilot/agents/alpha.md", "copilot/agents/alpha.md")
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	if !matched {
		t.Fatalf("expected match for expanded ${XDG_CONFIG_HOME}")
	}
}

func TestMatcherGlobXDGConfigUnset(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", "")
	reg := Registry{
		Version: "1",
		Patterns: []Pattern{
			{
				ID:           "xdg",
				ToolID:       "tool",
				ToolName:     "Tool",
				Kind:         "config",
				Scope:        "user",
				Paths:        []string{"$XDG_CONFIG_HOME/copilot/config.json"},
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

	matched, _, err := compiled[0].Match("/tmp/xdg/copilot/config.json", "copilot/config.json")
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	if matched {
		t.Fatalf("expected no match when XDG_CONFIG_HOME is unset")
	}
}
