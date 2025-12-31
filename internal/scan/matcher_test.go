package scan

import (
	"path/filepath"
	"testing"
)

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

func TestRegistryCopilotPatterns(t *testing.T) {
	home := filepath.Join(t.TempDir(), "home")
	xdg := filepath.Join(t.TempDir(), "xdg")
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", xdg)

	reg := loadRegistryFixture(t)
	compiled, err := CompilePatterns(reg)
	if err != nil {
		t.Fatalf("CompilePatterns: %v", err)
	}

	patternsByID := compiledByID(compiled)
	repoRoot := t.TempDir()

	assertMatchRel(t, patternsByID, "github-copilot-instructions", repoRoot, ".github/copilot-instructions.md")
	assertMatchRel(t, patternsByID, "github-copilot-cli-instructions", repoRoot, ".github/copilot-instructions.md")
	assertMatchRel(t, patternsByID, "github-copilot-cli-instructions-dir", repoRoot, ".github/copilot-instructions/nested/rule.instructions.md")
	assertMatchRel(t, patternsByID, "github-copilot-cli-agents-repo", repoRoot, ".github/agents/alpha.md")
	assertMatchRel(t, patternsByID, "github-copilot-agents", repoRoot, "AGENTS.md")
	assertMatchRel(t, patternsByID, "github-copilot-cli-agents-md", repoRoot, "AGENTS.md")

	assertMatchAbs(t, patternsByID, "github-copilot-cli-config-user", filepath.Join(home, ".copilot", "config.json"))
	assertMatchAbs(t, patternsByID, "github-copilot-cli-mcp-config-user", filepath.Join(home, ".copilot", "mcp-config.json"))
	assertMatchAbs(t, patternsByID, "github-copilot-cli-config-user-xdg", filepath.Join(xdg, "copilot", "config.json"))
	assertMatchAbs(t, patternsByID, "github-copilot-cli-mcp-config-user-xdg", filepath.Join(xdg, "copilot", "mcp-config.json"))
	assertMatchAbs(t, patternsByID, "github-copilot-prompts-user", filepath.Join(home, ".config", "Code", "User", "prompts", "hello.prompt.md"))
	assertMatchAbs(t, patternsByID, "github-copilot-prompts-user-profiles", filepath.Join(home, ".config", "Code", "User", "profiles", "work", "prompts", "team.prompt.md"))

	copilotPatterns := filterByToolID(compiled, "github-copilot", "github-copilot-cli")
	assertNoMatchAny(t, copilotPatterns, repoRoot, ".github/workflows/build.yml")
	assertNoMatchAny(t, copilotPatterns, repoRoot, ".github/actions/action.yml")
	assertNoMatchAny(t, copilotPatterns, repoRoot, ".github/notes.md")
}

func compiledByID(patterns []CompiledPattern) map[string]CompiledPattern {
	byID := make(map[string]CompiledPattern, len(patterns))
	for _, pattern := range patterns {
		byID[pattern.Pattern.ID] = pattern
	}
	return byID
}

func filterByToolID(patterns []CompiledPattern, toolIDs ...string) []CompiledPattern {
	ids := make(map[string]struct{}, len(toolIDs))
	for _, id := range toolIDs {
		ids[id] = struct{}{}
	}

	var filtered []CompiledPattern
	for _, pattern := range patterns {
		if _, ok := ids[pattern.Pattern.ToolID]; ok {
			filtered = append(filtered, pattern)
		}
	}

	return filtered
}

func assertMatchRel(t *testing.T, patterns map[string]CompiledPattern, id string, repoRoot string, rel string) {
	t.Helper()
	relPath := filepath.FromSlash(rel)
	absPath := filepath.Join(repoRoot, relPath)
	assertPatternMatch(t, patterns, id, absPath, relPath)
}

func assertMatchAbs(t *testing.T, patterns map[string]CompiledPattern, id string, absPath string) {
	t.Helper()
	assertPatternMatch(t, patterns, id, absPath, filepath.Base(absPath))
}

func assertPatternMatch(t *testing.T, patterns map[string]CompiledPattern, id string, absPath string, relPath string) {
	t.Helper()
	pattern, ok := patterns[id]
	if !ok {
		t.Fatalf("pattern %s not found", id)
	}

	matched, _, err := pattern.Match(absPath, relPath)
	if err != nil {
		t.Fatalf("Match(%s): %v", id, err)
	}
	if !matched {
		t.Fatalf("expected match for %s at %s", id, filepath.ToSlash(relPath))
	}
}

func assertNoMatchAny(t *testing.T, patterns []CompiledPattern, repoRoot string, rel string) {
	t.Helper()
	relPath := filepath.FromSlash(rel)
	absPath := filepath.Join(repoRoot, relPath)
	for _, pattern := range patterns {
		matched, _, err := pattern.Match(absPath, relPath)
		if err != nil {
			t.Fatalf("Match(%s): %v", pattern.Pattern.ID, err)
		}
		if matched {
			t.Fatalf("unexpected match for %s at %s", pattern.Pattern.ID, filepath.ToSlash(relPath))
		}
	}
}
