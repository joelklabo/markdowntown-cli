package audit

import (
	"fmt"
	"sort"
	"strings"
)

const (
	ruleMissingInstructions = "MDTAUDIT001"
	ruleFrontmatterError    = "MDTAUDIT002"
	ruleEmptyFile           = "MDTAUDIT003"
	ruleGitignored          = "MDTAUDIT004"
	ruleRequiresSetting     = "MDTAUDIT005"
)

// DefaultRules returns the v1 audit rule set.
func DefaultRules() []Rule {
	return []Rule{
		missingInstructionsRule{},
		frontmatterErrorRule{},
		emptyFileRule{},
		gitignoredRule{},
		requiresSettingRule{},
	}
}

type missingInstructionsRule struct{}

type toolBucket struct {
	toolID   string
	toolName string
	entries  []ConfigEntryRef
}

func (missingInstructionsRule) ID() string {
	return ruleMissingInstructions
}

func (missingInstructionsRule) Apply(ctx Context) ([]Issue, error) {
	buckets := make(map[string]*toolBucket)
	hasInstructions := make(map[string]bool)

	for _, entry := range ctx.Scan.Configs {
		if entry.Scope != "repo" {
			continue
		}
		for _, tool := range entry.Tools {
			bucket := buckets[tool.ToolID]
			if bucket == nil {
				bucket = &toolBucket{toolID: tool.ToolID, toolName: tool.ToolName}
				buckets[tool.ToolID] = bucket
			}
			bucket.entries = append(bucket.entries, ConfigEntryRef{Entry: entry, Tool: tool})
			if tool.Kind == "instructions" {
				hasInstructions[tool.ToolID] = true
			}
		}
	}

	var issues []Issue
	keys := make([]string, 0, len(buckets))
	for key := range buckets {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		if hasInstructions[key] {
			continue
		}
		bucket := buckets[key]
		entries := collectEntries(bucket.entries)
		paths := uniqueRedactedPaths(entries, ctx.Redactor)
		evidence := evidenceList(entries, ctx.Redactor)
		toolName := bucket.toolName
		if toolName == "" {
			toolName = bucket.toolID
		}
		issues = append(issues, Issue{
			RuleID:     ruleMissingInstructions,
			Severity:   SeverityWarn,
			Title:      fmt.Sprintf("Missing instructions for %s", toolName),
			Message:    fmt.Sprintf("%s has configs but no repo-scope instructions were detected.", toolName),
			Suggestion: fmt.Sprintf("Add an instructions file for %s or remove unused configs.", toolName),
			Paths:      paths,
			Tools:      []string{bucket.toolID},
			Evidence:   evidence,
		})
	}

	return issues, nil
}

type frontmatterErrorRule struct{}

func (frontmatterErrorRule) ID() string {
	return ruleFrontmatterError
}

func (frontmatterErrorRule) Apply(ctx Context) ([]Issue, error) {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		if entry.FrontmatterError == nil || strings.TrimSpace(*entry.FrontmatterError) == "" {
			continue
		}
		issues = append(issues, issueForEntry(
			ruleFrontmatterError,
			SeverityError,
			"Frontmatter parse error",
			"YAML frontmatter failed to parse.",
			"Fix or remove YAML frontmatter so the file can be parsed.",
			entry,
			ctx.Redactor,
		))
	}
	return issues, nil
}

type emptyFileRule struct{}

func (emptyFileRule) ID() string {
	return ruleEmptyFile
}

func (emptyFileRule) Apply(ctx Context) ([]Issue, error) {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		if entry.Warning == nil || *entry.Warning != "empty" {
			continue
		}
		issues = append(issues, issueForEntry(
			ruleEmptyFile,
			SeverityWarn,
			"Empty config or instruction file",
			"File is empty and may be ignored by tools.",
			"Add meaningful content or remove the empty file.",
			entry,
			ctx.Redactor,
		))
	}
	return issues, nil
}

type gitignoredRule struct{}

func (gitignoredRule) ID() string {
	return ruleGitignored
}

func (gitignoredRule) Apply(ctx Context) ([]Issue, error) {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		if entry.Scope != "repo" || !entry.Gitignored {
			continue
		}
		issues = append(issues, issueForEntry(
			ruleGitignored,
			SeverityWarn,
			"Config file is gitignored",
			"File is ignored by git and may not be shared with collaborators.",
			"Remove it from .gitignore or relocate it to a tracked path.",
			entry,
			ctx.Redactor,
		))
	}
	return issues, nil
}

type requiresSettingRule struct{}

func (requiresSettingRule) ID() string {
	return ruleRequiresSetting
}

func (requiresSettingRule) Apply(ctx Context) ([]Issue, error) {
	seen := make(map[string]struct{})
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		for _, tool := range entry.Tools {
			for _, hint := range tool.Hints {
				if hint.Type != "requires-setting" || hint.Setting == "" {
					continue
				}
				key := fmt.Sprintf("%s|%s|%s", tool.ToolID, entry.Path, hint.Setting)
				if _, ok := seen[key]; ok {
					continue
				}
				seen[key] = struct{}{}
				issues = append(issues, issueForEntry(
					ruleRequiresSetting,
					SeverityInfo,
					"Tool requires a setting to activate instructions",
					fmt.Sprintf("%s may require setting %s to enable instruction files.", tool.ToolName, hint.Setting),
					fmt.Sprintf("Enable %s to ensure %s instructions are applied.", hint.Setting, tool.ToolName),
					entry,
					ctx.Redactor,
				))
			}
		}
	}
	return issues, nil
}
