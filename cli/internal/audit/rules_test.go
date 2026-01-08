package audit

import (
	"strings"
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

func TestRuleConflictDetectsTestFixtures(t *testing.T) {
	entries := []scan.ConfigEntry{
		configEntry("/repo/GEMINI.md", "repo", "gemini-cli", "instructions"),
		configEntry("/repo/testdata/repos/integration/GEMINI.md", "repo", "gemini-cli", "instructions"),
		configEntry("/repo/examples/gemini/GEMINI.md", "repo", "gemini-cli", "instructions"),
	}
	ctx := testContext(entries, scan.Registry{})
	issues := ruleConflict(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one conflict issue, got %d", len(issues))
	}
	if !strings.Contains(issues[0].Message, "test/example") {
		t.Fatalf("expected message to mention test/example, got: %s", issues[0].Message)
	}
	if !strings.Contains(issues[0].Message, "2 test/example of 3") {
		t.Fatalf("expected message to show 2 test/example of 3 paths, got: %s", issues[0].Message)
	}
	if !strings.Contains(issues[0].Suggestion, "test fixtures or examples") {
		t.Fatalf("expected suggestion to mention test fixtures, got: %s", issues[0].Suggestion)
	}
}

func TestRuleConflictDetectsBuildOutput(t *testing.T) {
	entries := []scan.ConfigEntry{
		configEntry("/repo/GEMINI.md", "repo", "gemini-cli", "instructions"),
		configEntry("/repo/.next/standalone/GEMINI.md", "repo", "gemini-cli", "instructions"),
		configEntry("/repo/dist/GEMINI.md", "repo", "gemini-cli", "instructions"),
	}
	ctx := testContext(entries, scan.Registry{})
	issues := ruleConflict(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one conflict issue, got %d", len(issues))
	}
	if !strings.Contains(issues[0].Message, "build output") {
		t.Fatalf("expected message to mention build output, got: %s", issues[0].Message)
	}
	if !strings.Contains(issues[0].Message, "2 build output of 3") {
		t.Fatalf("expected message to show 2 build output of 3 paths, got: %s", issues[0].Message)
	}
	if !strings.Contains(issues[0].Suggestion, "build output directories") {
		t.Fatalf("expected suggestion to mention build output, got: %s", issues[0].Suggestion)
	}
}

func TestRuleConflictDetectsMixedBuildAndTest(t *testing.T) {
	entries := []scan.ConfigEntry{
		configEntry("/repo/GEMINI.md", "repo", "gemini-cli", "instructions"),
		configEntry("/repo/.next/standalone/GEMINI.md", "repo", "gemini-cli", "instructions"),
		configEntry("/repo/testdata/GEMINI.md", "repo", "gemini-cli", "instructions"),
	}
	ctx := testContext(entries, scan.Registry{})
	issues := ruleConflict(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one conflict issue, got %d", len(issues))
	}
	// Should contain both build output and test/example counts
	if !strings.Contains(issues[0].Message, "build output") {
		t.Fatalf("expected message to mention build output, got: %s", issues[0].Message)
	}
	if !strings.Contains(issues[0].Message, "test/example") {
		t.Fatalf("expected message to mention test/example, got: %s", issues[0].Message)
	}
	if !strings.Contains(issues[0].Suggestion, "build output or test fixtures") {
		t.Fatalf("expected suggestion to mention both, got: %s", issues[0].Suggestion)
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

func TestRuleScanWarningNodeModulesSuggestion(t *testing.T) {
	ctx := testContext(nil, scan.Registry{})
	ctx.Scan.Warnings = []scan.Warning{
		{Path: "/repo/node_modules/.pnpm/node_modules/@foo/bar", Code: "ERROR", Message: "lstat /repo/packages/bar: no such file or directory"},
	}
	issues := ruleScanWarning(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue, got %d", len(issues))
	}
	if !strings.Contains(issues[0].Suggestion, "stale symlink") {
		t.Fatalf("expected node_modules-specific suggestion, got: %s", issues[0].Suggestion)
	}
	requireRuleData(t, issues[0], "discovery")
}

func TestRuleScanWarningNonNodeModulesKeepsDefaultSuggestion(t *testing.T) {
	ctx := testContext(nil, scan.Registry{})
	ctx.Scan.Warnings = []scan.Warning{
		{Path: "/repo/.config/foo", Code: "ERROR", Message: "no such file or directory"},
	}
	issues := ruleScanWarning(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue, got %d", len(issues))
	}
	expectedSuggestion := "Verify permissions and registry paths, then re-run the scan."
	if issues[0].Suggestion != expectedSuggestion {
		t.Fatalf("expected default suggestion, got: %s", issues[0].Suggestion)
	}
}

func TestRuleScanWarningGroupsBySameTarget(t *testing.T) {
	ctx := testContext(nil, scan.Registry{})
	ctx.Scan.Warnings = []scan.Warning{
		{Path: "/repo/node_modules/.pnpm/node_modules/@foo/bar", Code: "ERROR", Message: "lstat /repo/packages/bar: no such file or directory"},
		{Path: "/repo/apps/docs/node_modules/@foo/bar", Code: "ERROR", Message: "lstat /repo/packages/bar: no such file or directory"},
		{Path: "/repo/node_modules/.pnpm/node_modules/@foo/baz", Code: "ERROR", Message: "lstat /repo/packages/baz: no such file or directory"},
	}
	issues := ruleScanWarning(ctx)
	// Should be 2 issues: one for /repo/packages/bar (2 symlinks), one for /repo/packages/baz (1 symlink)
	if len(issues) != 2 {
		t.Fatalf("expected two grouped issues, got %d", len(issues))
	}
	// Find the issue with 2 symlinks
	var twoSymlinks, oneSymlink *Issue
	for i := range issues {
		count, ok := issues[i].Evidence["affectedCount"].(int)
		if ok && count == 2 {
			twoSymlinks = &issues[i]
		} else if ok && count == 1 {
			oneSymlink = &issues[i]
		}
	}
	if twoSymlinks == nil {
		t.Fatal("expected an issue with affectedCount=2")
	}
	if oneSymlink == nil {
		t.Fatal("expected an issue with affectedCount=1")
	}
	if len(twoSymlinks.Paths) != 2 {
		t.Fatalf("expected 2 paths for grouped issue, got %d", len(twoSymlinks.Paths))
	}
	if !strings.Contains(twoSymlinks.Message, "2 symlinks affected") {
		t.Fatalf("expected message to mention 2 symlinks, got: %s", twoSymlinks.Message)
	}
	if !strings.Contains(twoSymlinks.Suggestion, "2 stale symlink") {
		t.Fatalf("expected suggestion to mention 2 stale symlinks, got: %s", twoSymlinks.Suggestion)
	}
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

func TestRuleOversizedConfig(t *testing.T) {
	largeSize := int64(2 * 1024 * 1024) // 2MB
	entry := configEntry("/repo/AGENTS.md", "repo", "codex", "instructions")
	entry.SizeBytes = &largeSize
	ctx := testContext([]scan.ConfigEntry{entry}, scan.Registry{})
	issues := ruleOversizedConfig(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one oversized issue, got %d", len(issues))
	}
	if issues[0].RuleID != "MD018" {
		t.Fatalf("unexpected rule id: %s", issues[0].RuleID)
	}
	if issues[0].Severity != SeverityWarning {
		t.Fatalf("expected warning severity, got %s", issues[0].Severity)
	}
	if issues[0].Evidence["sizeBytes"] != largeSize {
		t.Fatalf("expected sizeBytes in evidence")
	}
	if issues[0].Evidence["threshold"] != oversizedThreshold {
		t.Fatalf("expected threshold in evidence")
	}
	requireRuleData(t, issues[0], "content")
}

func TestRuleOversizedConfigSkipsSmallFiles(t *testing.T) {
	smallSize := int64(1024) // 1KB
	entry := configEntry("/repo/AGENTS.md", "repo", "codex", "instructions")
	entry.SizeBytes = &smallSize
	ctx := testContext([]scan.ConfigEntry{entry}, scan.Registry{})
	issues := ruleOversizedConfig(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected no issues for small files, got %d", len(issues))
	}
}

func TestRuleOversizedConfigSkipsNilSize(t *testing.T) {
	entry := configEntry("/repo/AGENTS.md", "repo", "codex", "instructions")
	entry.SizeBytes = nil
	ctx := testContext([]scan.ConfigEntry{entry}, scan.Registry{})
	issues := ruleOversizedConfig(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected no issues for nil size, got %d", len(issues))
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

func TestRuleOversizedConfigBoundary(t *testing.T) {
	// Test file exactly at 1MB threshold (should trigger)
	exactThreshold := int64(1024 * 1024)
	entryAt := configEntry("/repo/AGENTS.md", "repo", "codex", "instructions")
	entryAt.SizeBytes = &exactThreshold
	ctx := testContext([]scan.ConfigEntry{entryAt}, scan.Registry{})
	issues := ruleOversizedConfig(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one issue for file exactly at 1MB threshold, got %d", len(issues))
	}
	if issues[0].Evidence["sizeBytes"] != exactThreshold {
		t.Fatalf("expected sizeBytes %d in evidence, got %v", exactThreshold, issues[0].Evidence["sizeBytes"])
	}

	// Test file at 1MB - 1 byte (should NOT trigger)
	belowThreshold := int64(1024*1024 - 1)
	entryBelow := configEntry("/repo/AGENTS.md", "repo", "codex", "instructions")
	entryBelow.SizeBytes = &belowThreshold
	ctx = testContext([]scan.ConfigEntry{entryBelow}, scan.Registry{})
	issues = ruleOversizedConfig(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected no issues for file at 1MB - 1 byte, got %d", len(issues))
	}
}

func TestRuleShadowedConfig(t *testing.T) {
	// User config shadowed by repo config with nearest-ancestor loadBehavior
	repoEntry := configEntryWithLoadBehavior("/repo/CLAUDE.md", "repo", "claude-code", "instructions", "nearest-ancestor")
	userEntry := configEntryWithLoadBehavior("/home/user/.claude/CLAUDE.md", "user", "claude-code", "instructions", "nearest-ancestor")
	ctx := testContext([]scan.ConfigEntry{repoEntry, userEntry}, scan.Registry{})
	issues := ruleShadowedConfig(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one shadowed config issue, got %d", len(issues))
	}
	if issues[0].RuleID != "MD013" {
		t.Fatalf("unexpected rule id: %s", issues[0].RuleID)
	}
	if issues[0].Severity != SeverityInfo {
		t.Fatalf("expected info severity, got %s", issues[0].Severity)
	}
	if !strings.Contains(issues[0].Message, "shadowed by a higher-precedence repo-scope config") {
		t.Fatalf("unexpected message: %s", issues[0].Message)
	}
	if issues[0].Evidence["loadBehavior"] != "nearest-ancestor" {
		t.Fatalf("expected loadBehavior evidence, got %v", issues[0].Evidence["loadBehavior"])
	}
	shadowedBy, ok := issues[0].Evidence["shadowedBy"].(string)
	if !ok || !strings.Contains(shadowedBy, "CLAUDE.md") {
		t.Fatalf("expected shadowedBy evidence to contain CLAUDE.md, got %v", issues[0].Evidence["shadowedBy"])
	}
	requireRuleData(t, issues[0], "scope")
}

func TestRuleShadowedConfigGlobalShadowedByUser(t *testing.T) {
	// Global config shadowed by user config
	userEntry := configEntryWithLoadBehavior("/home/user/.cursor/rules.md", "user", "cursor", "rules", "single")
	globalEntry := configEntryWithLoadBehavior("/etc/cursor/rules.md", "global", "cursor", "rules", "single")
	ctx := testContext([]scan.ConfigEntry{userEntry, globalEntry}, scan.Registry{})
	issues := ruleShadowedConfig(ctx)
	if len(issues) != 1 {
		t.Fatalf("expected one shadowed config issue, got %d", len(issues))
	}
	if !strings.Contains(issues[0].Message, "shadowed by a higher-precedence user-scope config") {
		t.Fatalf("unexpected message: %s", issues[0].Message)
	}
	if issues[0].Paths[0].Scope != "global" {
		t.Fatalf("expected global scope in paths, got %s", issues[0].Paths[0].Scope)
	}
}

func TestRuleShadowedConfigMultipleShadowed(t *testing.T) {
	// Both user and global configs shadowed by repo config
	repoEntry := configEntryWithLoadBehavior("/repo/.cursor/rules.md", "repo", "cursor", "rules", "nearest-ancestor")
	userEntry := configEntryWithLoadBehavior("/home/user/.cursor/rules.md", "user", "cursor", "rules", "nearest-ancestor")
	globalEntry := configEntryWithLoadBehavior("/etc/cursor/rules.md", "global", "cursor", "rules", "nearest-ancestor")
	ctx := testContext([]scan.ConfigEntry{repoEntry, userEntry, globalEntry}, scan.Registry{})
	issues := ruleShadowedConfig(ctx)
	if len(issues) != 2 {
		t.Fatalf("expected two shadowed config issues, got %d", len(issues))
	}
	// Both issues should reference repo as the shadowing config
	for _, issue := range issues {
		if !strings.Contains(issue.Message, "repo-scope") {
			t.Fatalf("expected repo-scope in message, got: %s", issue.Message)
		}
	}
}

func TestRuleShadowedConfigSkipsMergeLoadBehavior(t *testing.T) {
	// Configs with "merge" loadBehavior should not trigger shadowing
	repoEntry := configEntryWithLoadBehavior("/repo/AGENTS.md", "repo", "codex", "instructions", "merge")
	userEntry := configEntryWithLoadBehavior("/home/user/AGENTS.md", "user", "codex", "instructions", "merge")
	ctx := testContext([]scan.ConfigEntry{repoEntry, userEntry}, scan.Registry{})
	issues := ruleShadowedConfig(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected no issues for merge loadBehavior, got %d", len(issues))
	}
}

func TestRuleShadowedConfigSkipsEmptyLoadBehavior(t *testing.T) {
	// Configs with empty loadBehavior should not trigger shadowing
	repoEntry := configEntryWithLoadBehavior("/repo/config.md", "repo", "tool", "kind", "")
	userEntry := configEntryWithLoadBehavior("/home/user/config.md", "user", "tool", "kind", "")
	ctx := testContext([]scan.ConfigEntry{repoEntry, userEntry}, scan.Registry{})
	issues := ruleShadowedConfig(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected no issues for empty loadBehavior, got %d", len(issues))
	}
}

func TestRuleShadowedConfigSingleEntry(t *testing.T) {
	// Single config should not trigger shadowing
	repoEntry := configEntryWithLoadBehavior("/repo/CLAUDE.md", "repo", "claude-code", "instructions", "nearest-ancestor")
	ctx := testContext([]scan.ConfigEntry{repoEntry}, scan.Registry{})
	issues := ruleShadowedConfig(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected no issues for single entry, got %d", len(issues))
	}
}

func TestRuleShadowedConfigSameScopeNoShadow(t *testing.T) {
	// Two configs in the same scope should not trigger shadowing (that's MD001 conflict)
	repoEntry1 := configEntryWithLoadBehavior("/repo/CLAUDE.md", "repo", "claude-code", "instructions", "nearest-ancestor")
	repoEntry2 := configEntryWithLoadBehavior("/repo/subdir/CLAUDE.md", "repo", "claude-code", "instructions", "nearest-ancestor")
	ctx := testContext([]scan.ConfigEntry{repoEntry1, repoEntry2}, scan.Registry{})
	issues := ruleShadowedConfig(ctx)
	if len(issues) != 0 {
		t.Fatalf("expected no issues for same-scope configs, got %d", len(issues))
	}
}

func configEntryWithLoadBehavior(path, scope, toolID, kind, loadBehavior string) scan.ConfigEntry {
	return scan.ConfigEntry{
		Path:  path,
		Scope: scope,
		Tools: []scan.ToolEntry{{ToolID: toolID, Kind: kind, LoadBehavior: loadBehavior}},
	}
}
