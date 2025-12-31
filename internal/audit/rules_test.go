package audit

import (
	"testing"

	"markdowntown-cli/internal/scan"
)

func TestRuleConflictExcludesOverridePair(t *testing.T) {
	entries := []scan.ConfigEntry{
		configEntry("/repo/AGENTS.md", "repo", "codex", "instructions"),
		configEntry("/repo/AGENTS.override.md", "repo", "codex", "instructions"),
	}
	ctx := testContext(entries, scan.Registry{})
	issues := ruleConflict(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected override pair to be excluded")
	}
}

func TestRuleConflictEmitsIssue(t *testing.T) {
	entries := []scan.ConfigEntry{
		configEntry("/repo/.cursor/rules.md", "repo", "cursor", "rules"),
		configEntry("/repo/.cursor/rules2.md", "repo", "cursor", "rules"),
	}
	ctx := testContext(entries, scan.Registry{})
	issues := ruleConflict(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one conflict issue, got %d", len(issues))
	}
	if issues[0].RuleID != "MD001" {
		t.Fatalf("unexpected rule id: %s", issues[0].RuleID)
	}
}

func TestRuleFrontmatterStableMessage(t *testing.T) {
	errText := "yaml: bad"
	entry := configEntry("/repo/AGENTS.md", "repo", "codex", "instructions")
	entry.FrontmatterError = &errText
	ctx := testContext([]scan.ConfigEntry{entry}, scan.Registry{})
	issues := ruleFrontmatter(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue")
	}
	if issues[0].Message != "Invalid YAML frontmatter." {
		t.Fatalf("unexpected message: %s", issues[0].Message)
	}
	if issues[0].Evidence["frontmatterError"] != errText {
		t.Fatalf("expected frontmatter error in evidence")
	}
}

func TestRuleEmptyUsesWarningOrSize(t *testing.T) {
	warning := "empty"
	size := int64(0)
	entryWarning := configEntry("/repo/empty.md", "repo", "codex", "instructions")
	entryWarning.Warning = &warning
	entrySize := configEntry("/repo/empty2.md", "repo", "codex", "instructions")
	entrySize.SizeBytes = &size
	ctx := testContext([]scan.ConfigEntry{entryWarning, entrySize}, scan.Registry{})
	issues := ruleEmpty(ctx)
	if len(issues) != 2 {
		t.Fatalf("expected two empty issues, got %d", len(issues))
	}
}

func TestRuleNoRepoConfig(t *testing.T) {
	userEntry := configEntry("/home/user/.cursor/rules.md", "user", "cursor", "rules")
	reg := scan.Registry{Patterns: []scan.Pattern{{ToolID: "cursor", Kind: "rules", Scope: "repo", Paths: []string{".cursorrules"}}}}
	ctx := testContext([]scan.ConfigEntry{userEntry}, reg)
	issues := ruleNoRepoConfig(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue, got %d", len(issues))
	}
	paths := issues[0].Evidence["candidatePaths"].([]string)
	if len(paths) != 1 || paths[0] != ".cursorrules" {
		t.Fatalf("unexpected candidate paths: %v", paths)
	}
}

func TestRuleUnreadableSeverity(t *testing.T) {
	errAccess := "EACCES"
	errMissing := "ENOENT"
	repoEntry := configEntry("/repo/secret.md", "repo", "codex", "instructions")
	repoEntry.Error = &errAccess
	userEntry := configEntry("/home/user/missing.md", "user", "codex", "instructions")
	userEntry.Error = &errMissing
	ctx := testContext([]scan.ConfigEntry{repoEntry, userEntry}, scan.Registry{})
	issues := ruleUnreadable(ctx)
	if len(issues) != 2 {
		t.Fatalf("expected two issues")
	}
	for _, issue := range issues {
		if issue.Paths[0].Scope == "repo" && issue.Severity != SeverityError {
			t.Fatalf("expected repo unreadable to be error")
		}
		if issue.Paths[0].Scope != "repo" && issue.Severity != SeverityWarning {
			t.Fatalf("expected non-repo unreadable to be warning")
		}
	}
}

func testContext(entries []scan.ConfigEntry, reg scan.Registry) Context {
	return Context{
		Scan:     scan.Output{Configs: entries},
		Registry: reg,
		Redactor: NewRedactor("/repo", "/home/user", "/home/user/.config", RedactAuto),
	}
}

func configEntry(path, scope, toolID, kind string) scan.ConfigEntry {
	return scan.ConfigEntry{
		Path:  path,
		Scope: scope,
		Tools: []scan.ToolEntry{{ToolID: toolID, Kind: kind}},
	}
}
