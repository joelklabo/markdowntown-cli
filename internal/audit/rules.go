package audit

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"markdowntown-cli/internal/scan"
)

// Context provides scan and registry data for rules.
type Context struct {
	Scan     scan.Output
	Registry scan.Registry
	Redactor *Redactor
}

// Rule describes a rule evaluator.
type Rule struct {
	ID       string
	Severity Severity
	Run      func(Context) []Issue
}

// DefaultRules returns the v1 rule set.
func DefaultRules() []Rule {
	return []Rule{
		{ID: "MD001", Severity: SeverityError, Run: ruleConflict},
		{ID: "MD002", Severity: SeverityWarning, Run: ruleGitignored},
		{ID: "MD003", Severity: SeverityError, Run: ruleFrontmatter},
		{ID: "MD004", Severity: SeverityWarning, Run: ruleEmpty},
		{ID: "MD005", Severity: SeverityInfo, Run: ruleNoRepoConfig},
		{ID: "MD006", Severity: SeverityWarning, Run: ruleUnreadable},
		{ID: "MD007", Severity: SeverityWarning, Run: ruleFrontmatterConflict},
	}
}

// RunRules executes the provided rules and returns the aggregated issues.
func RunRules(ctx Context, rules []Rule) []Issue {
	var issues []Issue
	for _, rule := range rules {
		issues = append(issues, rule.Run(ctx)...)
	}
	return issues
}

func ruleConflict(ctx Context) []Issue {
	groups := make(map[conflictKey][]scan.ConfigEntry)
	for _, entry := range ctx.Scan.Configs {
		for _, tool := range entry.Tools {
			key := conflictKey{Scope: entry.Scope, ToolID: tool.ToolID, Kind: tool.Kind}
			groups[key] = append(groups[key], entry)
		}
	}

	var issues []Issue
	for key, entries := range groups {
		if len(entries) <= 1 {
			continue
		}
		if isMultiFileKind(key.Kind) {
			continue
		}
		paths := make([]string, 0, len(entries))
		for _, entry := range entries {
			paths = append(paths, entry.Path)
		}
		if isAgentsOverridePair(paths) {
			continue
		}

		issuePaths := make([]Path, 0, len(entries))
		for _, entry := range entries {
			issuePaths = append(issuePaths, redactPath(ctx, entry.Path, entry.Scope))
		}
		issuePaths = dedupePaths(issuePaths)
		issue := Issue{
			RuleID:     "MD001",
			Severity:   SeverityError,
			Title:      "Config conflict",
			Message:    fmt.Sprintf("Conflicting configs for %s (%s) in %s scope.", key.ToolID, key.Kind, key.Scope),
			Suggestion: "Keep exactly one config for this tool/kind/scope. Delete or rename extras, or use a documented override pair.",
			Paths:      issuePaths,
			Tools:      []Tool{{ToolID: key.ToolID, Kind: key.Kind}},
			Evidence: map[string]any{
				"scope":  key.Scope,
				"toolId": key.ToolID,
				"kind":   key.Kind,
			},
		}
		issues = append(issues, issue)
	}
	return issues
}

func ruleFrontmatterConflict(ctx Context) []Issue {
	type conflictKey struct {
		ToolID string
		Scope  string
		Kind   string
		Field  string
		Value  string
	}

	groups := make(map[conflictKey][]scan.ConfigEntry)
	for _, entry := range ctx.Scan.Configs {
		if len(entry.Frontmatter) == 0 {
			continue
		}
		for _, tool := range entry.Tools {
			keys := frontmatterConflictKeys(tool.Kind)
			if len(keys) == 0 {
				continue
			}
			for _, key := range keys {
				values := frontmatterValues(entry.Frontmatter, key)
				for _, value := range values {
					groupKey := conflictKey{
						ToolID: tool.ToolID,
						Scope:  entry.Scope,
						Kind:   tool.Kind,
						Field:  key,
						Value:  value,
					}
					groups[groupKey] = append(groups[groupKey], entry)
				}
			}
		}
	}

	var issues []Issue
	for key, entries := range groups {
		if len(entries) <= 1 {
			continue
		}
		paths := make([]Path, 0, len(entries))
		for _, entry := range entries {
			paths = append(paths, redactPath(ctx, entry.Path, entry.Scope))
		}
		paths = dedupePaths(paths)
		if len(paths) == 0 {
			continue
		}
		displayValue := key.Value
		if displayValue == "" {
			continue
		}
		issue := Issue{
			RuleID:     "MD007",
			Severity:   SeverityWarning,
			Title:      "Duplicate frontmatter value",
			Message:    fmt.Sprintf("Multiple %s configs for %s share %s=%q in %s scope.", key.Kind, key.ToolID, key.Field, displayValue, key.Scope),
			Suggestion: "Ensure frontmatter identifiers are unique or consolidate duplicate configs.",
			Paths:      paths,
			Tools:      []Tool{{ToolID: key.ToolID, Kind: key.Kind}},
			Range:      frontmatterLocation(entries[0], key.Field),
			Evidence: map[string]any{
				"scope": key.Scope,
				"tool":  key.ToolID,
				"kind":  key.Kind,
				"field": key.Field,
				"value": displayValue,
				"count": len(entries),
			},
		}
		issues = append(issues, issue)
	}

	sort.SliceStable(issues, func(i, j int) bool {
		if issues[i].Tools[0].ToolID != issues[j].Tools[0].ToolID {
			return issues[i].Tools[0].ToolID < issues[j].Tools[0].ToolID
		}
		if issues[i].Tools[0].Kind != issues[j].Tools[0].Kind {
			return issues[i].Tools[0].Kind < issues[j].Tools[0].Kind
		}
		if issues[i].Paths[0].Scope != issues[j].Paths[0].Scope {
			return issues[i].Paths[0].Scope < issues[j].Paths[0].Scope
		}
		if issues[i].Paths[0].Path != issues[j].Paths[0].Path {
			return issues[i].Paths[0].Path < issues[j].Paths[0].Path
		}
		return strings.Compare(issues[i].Message, issues[j].Message) < 0
	})

	return issues
}

func ruleGitignored(ctx Context) []Issue {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		if entry.Scope != "repo" || !entry.Gitignored {
			continue
		}
		issue := Issue{
			RuleID:     "MD002",
			Severity:   SeverityWarning,
			Title:      "Gitignored config",
			Message:    "Repo config is ignored by git; teammates and CI will not see it.",
			Suggestion: "Remove this path from .gitignore or move the file to a tracked location.",
			Paths:      []Path{redactPath(ctx, entry.Path, entry.Scope)},
			Tools:      toolsForEntry(entry),
			Evidence: map[string]any{
				"gitignored": true,
			},
		}
		issues = append(issues, issue)
	}
	return issues
}

func ruleFrontmatter(ctx Context) []Issue {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		if entry.FrontmatterError == nil {
			continue
		}
		issue := Issue{
			RuleID:     "MD003",
			Severity:   SeverityError,
			Title:      "Invalid YAML frontmatter",
			Message:    "Invalid YAML frontmatter.",
			Suggestion: "Fix the YAML frontmatter syntax or remove it entirely.",
			Paths:      []Path{redactPath(ctx, entry.Path, entry.Scope)},
			Tools:      toolsForEntry(entry),
			Evidence: map[string]any{
				"frontmatterError": *entry.FrontmatterError,
			},
		}

		// Try to extract line info from "yaml: line N: ..."
		errMsg := *entry.FrontmatterError
		if strings.Contains(errMsg, "line ") {
			var line int
			_, err := fmt.Sscanf(errMsg[strings.Index(errMsg, "line ")+5:], "%d", &line)
			if err == nil {
				issue.Range = &Range{
					StartLine: line,
					StartCol:  1,
					EndLine:   line,
					EndCol:    1,
				}
			}
		}

		issues = append(issues, issue)
	}
	return issues
}

func ruleEmpty(ctx Context) []Issue {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		emptyWarning := entry.Warning != nil && *entry.Warning == "empty"
		emptySize := entry.SizeBytes != nil && *entry.SizeBytes == 0
		if !emptyWarning && !emptySize {
			continue
		}
		evidence := map[string]any{}
		if entry.Warning != nil {
			evidence["warning"] = *entry.Warning
		}
		if entry.SizeBytes != nil {
			evidence["sizeBytes"] = *entry.SizeBytes
		}
		issue := Issue{
			RuleID:     "MD004",
			Severity:   SeverityWarning,
			Title:      "Empty config file",
			Message:    "Config file is empty and will be ignored.",
			Suggestion: "Add the intended instructions or delete the file.",
			Paths:      []Path{redactPath(ctx, entry.Path, entry.Scope)},
			Tools:      toolsForEntry(entry),
			Evidence:   evidence,
		}
		issues = append(issues, issue)
	}
	return issues
}

func ruleNoRepoConfig(ctx Context) []Issue {
	repoConfigs := make(map[toolKindKey]bool)
	userConfigs := make(map[toolKindKey][]scan.ConfigEntry)
	for _, entry := range ctx.Scan.Configs {
		for _, tool := range entry.Tools {
			key := toolKindKey{ToolID: tool.ToolID, Kind: tool.Kind}
			if entry.Scope == "repo" {
				repoConfigs[key] = true
				continue
			}
			userConfigs[key] = append(userConfigs[key], entry)
		}
	}

	var issues []Issue
	for key, entries := range userConfigs {
		if repoConfigs[key] {
			continue
		}
		paths := make([]Path, 0, len(entries))
		scopes := make(map[string]struct{})
		for _, entry := range entries {
			paths = append(paths, redactPath(ctx, entry.Path, entry.Scope))
			scopes[entry.Scope] = struct{}{}
		}
		paths = dedupePaths(paths)
		var detectedScopes []string
		for scope := range scopes {
			detectedScopes = append(detectedScopes, scope)
		}
		sort.Strings(detectedScopes)

		candidatePaths := candidateRepoPaths(ctx.Registry, key)
		if len(candidatePaths) == 0 {
			continue
		}
		issue := Issue{
			RuleID:     "MD005",
			Severity:   SeverityInfo,
			Title:      "No repo config",
			Message:    fmt.Sprintf("No repo-scoped config for %s (%s); only user/global configs detected.", key.ToolID, key.Kind),
			Suggestion: "Add a repo-scoped config for consistent behavior across teammates and CI.",
			Paths:      paths,
			Tools:      []Tool{{ToolID: key.ToolID, Kind: key.Kind}},
			Evidence: map[string]any{
				"detectedScopes": detectedScopes,
				"candidatePaths": candidatePaths,
			},
		}
		issues = append(issues, issue)
	}
	return issues
}

func ruleUnreadable(ctx Context) []Issue {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		if entry.Error == nil {
			continue
		}
		err := *entry.Error
		if err != "EACCES" && err != "ENOENT" && err != "ERROR" {
			continue
		}
		severity := SeverityWarning
		if entry.Scope == "repo" {
			severity = SeverityError
		}
		issue := Issue{
			RuleID:     "MD006",
			Severity:   severity,
			Title:      "Config unreadable",
			Message:    "Config file could not be read.",
			Suggestion: "Check the file permissions and ensure the path exists.",
			Paths:      []Path{redactPath(ctx, entry.Path, entry.Scope)},
			Tools:      toolsForEntry(entry),
			Evidence: map[string]any{
				"error": err,
			},
		}
		issues = append(issues, issue)
	}
	return issues
}

func redactPath(ctx Context, path string, scope string) Path {
	if ctx.Redactor == nil {
		return Path{Path: filepath.ToSlash(path), Scope: scope, Redacted: false}
	}
	return ctx.Redactor.RedactPath(path, scope)
}
