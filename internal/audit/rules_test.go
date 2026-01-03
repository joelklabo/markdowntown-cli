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

func TestRuleConflictSkipsMultiFileKinds(t *testing.T) {
	entries := []scan.ConfigEntry{
		configEntry("/home/user/.codex/prompts/alpha.md", "user", "codex", "prompts"),
		configEntry("/home/user/.codex/prompts/beta.md", "user", "codex", "prompts"),
	}
	ctx := testContext(entries, scan.Registry{})
	issues := ruleConflict(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected multi-file kinds to skip conflicts")
	}
}

func TestRuleGitignored(t *testing.T) {
	repoEntry := configEntry("/repo/AGENTS.md", "repo", "codex", "instructions")
	repoEntry.Gitignored = true
	userEntry := configEntry("/home/user/AGENTS.md", "user", "codex", "instructions")
	userEntry.Gitignored = true
	ctx := testContext([]scan.ConfigEntry{repoEntry, userEntry}, scan.Registry{})
	issues := ruleGitignored(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one gitignored issue, got %d", len(issues))
	}
	if issues[0].RuleID != "MD002" {
		t.Fatalf("unexpected rule id: %s", issues[0].RuleID)
	}
	if issues[0].Severity != SeverityWarning {
		t.Fatalf("expected warning severity, got %s", issues[0].Severity)
	}
	if issues[0].Message != "Repo config is ignored by git; teammates and CI will not see it." {
		t.Fatalf("unexpected message: %s", issues[0].Message)
	}
	if issues[0].Suggestion != "Remove this path from .gitignore or move the file to a tracked location." {
		t.Fatalf("unexpected suggestion: %s", issues[0].Suggestion)
	}
	if issues[0].Evidence["gitignored"] != true {
		t.Fatalf("expected gitignored evidence, got %#v", issues[0].Evidence["gitignored"])
	}
	requireRuleData(t, issues[0], "scope")
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

func TestRuleFrontmatterRange(t *testing.T) {
	errText := "yaml: line 5: did not find expected key"
	entry := configEntry("/repo/AGENTS.md", "repo", "codex", "instructions")
	entry.FrontmatterError = &errText
	ctx := testContext([]scan.ConfigEntry{entry}, scan.Registry{})
	issues := ruleFrontmatter(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue")
	}
	if issues[0].Range == nil {
		t.Fatal("expected range to be populated")
	}
	if issues[0].Range.StartLine != 5 {
		t.Errorf("expected start line 5, got %d", issues[0].Range.StartLine)
	}
}

func TestRuleFrontmatterConflictRange(t *testing.T) {
	entryA := configEntry("/home/user/.codex/skills/a/SKILL.md", "user", "codex", "skills")
	entryA.Frontmatter = map[string]any{"name": "Alpha"}
	entryA.FrontmatterLocations = map[string]scan.Range{"name": {StartLine: 2, StartCol: 1, EndLine: 2, EndCol: 6}}
	entryB := configEntry("/home/user/.codex/skills/b/SKILL.md", "user", "codex", "skills")
	entryB.Frontmatter = map[string]any{"name": "alpha"}
	ctx := testContext([]scan.ConfigEntry{entryA, entryB}, scan.Registry{})
	issues := ruleFrontmatterConflict(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one conflict issue")
	}
	if issues[0].Range == nil {
		t.Fatal("expected range to be populated")
	}
	if issues[0].Range.StartLine != 2 {
		t.Errorf("expected start line 2, got %d", issues[0].Range.StartLine)
	}
}

func TestRuleFrontmatterConflict(t *testing.T) {
	entryA := configEntry("/home/user/.codex/skills/a/SKILL.md", "user", "codex", "skills")
	entryA.Frontmatter = map[string]any{"name": "Alpha"}
	entryB := configEntry("/home/user/.codex/skills/b/SKILL.md", "user", "codex", "skills")
	entryB.Frontmatter = map[string]any{"name": "alpha"}
	ctx := testContext([]scan.ConfigEntry{entryA, entryB}, scan.Registry{})
	issues := ruleFrontmatterConflict(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one conflict issue, got %d", len(issues))
	}
	if issues[0].RuleID != "MD007" {
		t.Fatalf("unexpected rule id: %s", issues[0].RuleID)
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
	var warningIssue *Issue
	var sizeIssue *Issue
	for i := range issues {
		issue := &issues[i]
		if issue.Message != "Config file is empty and will be ignored." {
			t.Fatalf("unexpected message: %s", issue.Message)
		}
		if issue.Suggestion != "Add the intended instructions or delete the file." {
			t.Fatalf("unexpected suggestion: %s", issue.Suggestion)
		}
		if value, ok := issue.Evidence["warning"].(string); ok && value == "empty" {
			warningIssue = issue
		}
		if value, ok := issue.Evidence["sizeBytes"].(int64); ok && value == 0 {
			sizeIssue = issue
		}
	}
	if warningIssue == nil {
		t.Fatalf("expected warning evidence for empty config")
	}
	if sizeIssue == nil {
		t.Fatalf("expected sizeBytes evidence for empty config")
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

func TestRuleCircularSymlink(t *testing.T) {
	ctx := testContext(nil, scan.Registry{})
	ctx.Scan.Warnings = []scan.Warning{
		{Path: "/repo/.cursor", Code: "CIRCULAR_SYMLINK", Message: "Circular symlink detected"},
	}
	issues := ruleCircularSymlink(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue, got %d", len(issues))
	}
	if issues[0].RuleID != "MD008" {
		t.Fatalf("unexpected rule id: %s", issues[0].RuleID)
	}
	if issues[0].Evidence["warningCode"] != "CIRCULAR_SYMLINK" {
		t.Fatalf("expected warning code evidence")
	}
	if len(issues[0].Paths) != 1 {
		t.Fatalf("expected one path")
	}
	requireRuleData(t, issues[0], "discovery")
}

func TestRuleUnrecognizedStdin(t *testing.T) {
	ctx := testContext(nil, scan.Registry{})
	ctx.Scan.Warnings = []scan.Warning{
		{Path: "/repo/unknown.md", Code: "UNRECOGNIZED_STDIN", Message: "stdin path did not match any registry pattern"},
	}
	issues := ruleUnrecognizedStdin(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue, got %d", len(issues))
	}
	if issues[0].RuleID != "MD009" {
		t.Fatalf("unexpected rule id: %s", issues[0].RuleID)
	}
	if issues[0].Severity != SeverityInfo {
		t.Fatalf("expected info severity")
	}
	requireRuleData(t, issues[0], "discovery")
}

func TestRuleScanWarning(t *testing.T) {
	ctx := testContext(nil, scan.Registry{})
	ctx.Scan.Warnings = []scan.Warning{
		{Path: "/repo/AGENTS.md", Code: "EACCES", Message: "permission denied"},
		{Path: "/repo/README.md", Code: "ERROR", Message: "read error"},
	}
	issues := ruleScanWarning(ctx)
	if len(issues) != 2 {
		t.Fatalf("expected two issues, got %d", len(issues))
	}
	for _, issue := range issues {
		if issue.RuleID != "MD010" {
			t.Fatalf("unexpected rule id: %s", issue.RuleID)
		}
		if issue.Severity != SeverityWarning {
			t.Fatalf("expected warning severity")
		}
		requireRuleData(t, issue, "discovery")
	}
}

func TestRuleScanWarningEmptyPath(t *testing.T) {
	ctx := testContext(nil, scan.Registry{})
	ctx.Scan.Warnings = []scan.Warning{
		{Path: "", Code: "EACCES", Message: "permission denied"},
	}
	issues := ruleScanWarning(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue, got %d", len(issues))
	}
	if len(issues[0].Paths) != 0 {
		t.Fatalf("expected empty paths for pathless warning")
	}
	requireRuleData(t, issues[0], "discovery")
}

func TestRuleBinaryContent(t *testing.T) {
	skipped := "binary"
	size := int64(12)
	entry := configEntry("/repo/config.bin", "repo", "codex", "instructions")
	entry.ContentSkipped = &skipped
	entry.SizeBytes = &size
	ctx := testContext([]scan.ConfigEntry{entry}, scan.Registry{})
	issues := ruleBinaryContent(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue, got %d", len(issues))
	}
	if issues[0].RuleID != "MD011" {
		t.Fatalf("unexpected rule id: %s", issues[0].RuleID)
	}
	if issues[0].Evidence["contentSkipped"] != "binary" {
		t.Fatalf("expected contentSkipped evidence")
	}
	requireRuleData(t, issues[0], "content")
}

func TestRuleMissingFrontmatterID(t *testing.T) {
	entry := configEntry("/repo/.codex/skills/alpha/SKILL.md", "repo", "codex", "skills")
	entry.Frontmatter = map[string]any{}
	ctx := testContext([]scan.ConfigEntry{entry}, scan.Registry{})
	issues := ruleMissingFrontmatterID(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue, got %d", len(issues))
	}
	if issues[0].RuleID != "MD012" {
		t.Fatalf("unexpected rule id: %s", issues[0].RuleID)
	}
	requireRuleData(t, issues[0], "validity")
}

func TestRuleMissingFrontmatterIDSkipsPresentKey(t *testing.T) {
	entry := configEntry("/repo/.codex/skills/alpha/SKILL.md", "repo", "codex", "skills")
	entry.Frontmatter = map[string]any{"name": "Alpha"}
	ctx := testContext([]scan.ConfigEntry{entry}, scan.Registry{})
	issues := ruleMissingFrontmatterID(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected no issues when identifier present")
	}
}

func testContext(entries []scan.ConfigEntry, reg scan.Registry) Context {
	return Context{
		Scan:     scan.Output{RepoRoot: "/repo", Configs: entries},
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

func requireRuleData(t *testing.T, issue Issue, expectedCategory string) {
	t.Helper()
	data, ok := issue.Data.(RuleData)
	if !ok {
		t.Fatalf("expected rule data, got %T", issue.Data)
	}
	if data.Category != expectedCategory {
		t.Fatalf("unexpected category: %s", data.Category)
	}
	if data.DocURL == "" {
		t.Fatalf("expected doc url")
	}
}
