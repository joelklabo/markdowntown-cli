package audit

import (
	"fmt"
	"path/filepath"
	"sort"
	"time"

	"markdowntown-cli/internal/scan"
)

// Engine runs audit rules against scan output.
type Engine struct {
	Rules []Rule
	Now   func() time.Time
}

// Run executes the audit rules and returns deterministic output.
func (e Engine) Run(scanOutput scan.Output) (Output, error) {
	if scanOutput.SchemaVersion == "" {
		return Output{}, fmt.Errorf("audit: missing scan schema version")
	}
	if scanOutput.RegistryVersion == "" {
		return Output{}, fmt.Errorf("audit: missing registry version in scan input")
	}
	if scanOutput.ToolVersion == "" {
		return Output{}, fmt.Errorf("audit: missing tool version in scan input")
	}

	nowFn := e.Now
	if nowFn == nil {
		nowFn = time.Now
	}
	started := nowFn().UnixMilli()
	generated := nowFn().UnixMilli()

	ctx := Context{Scan: scanOutput}
	issues := make([]Issue, 0)
	rules := append([]Rule(nil), e.Rules...)
	sort.SliceStable(rules, func(i, j int) bool {
		return rules[i].ID() < rules[j].ID()
	})
	for _, rule := range rules {
		result, err := rule.Apply(ctx)
		if err != nil {
			return Output{}, fmt.Errorf("audit: rule %s: %w", rule.ID(), err)
		}
		issues = append(issues, result...)
	}

	for i := range issues {
		sort.Strings(issues[i].Paths)
		sort.Strings(issues[i].Tools)
	}

	sortIssues(issues)

	summary := summarizeIssues(issues)

	return Output{
		SchemaVersion:   SchemaVersion,
		ToolVersion:     scanOutput.ToolVersion,
		RegistryVersion: scanOutput.RegistryVersion,
		AuditStartedAt:  started,
		GeneratedAt:     generated,
		Input:           buildInputMeta(scanOutput),
		Summary:         summary,
		Issues:          issues,
	}, nil
}

func buildInputMeta(scanOutput scan.Output) InputMeta {
	roots := make([]string, 0, len(scanOutput.Scans))
	for _, root := range scanOutput.Scans {
		roots = append(roots, root.Root)
	}
	return InputMeta{
		RepoRoot:        scanOutput.RepoRoot,
		ScanStartedAt:   scanOutput.ScanStartedAt,
		ScanGeneratedAt: scanOutput.GeneratedAt,
		Scans:           roots,
	}
}

func summarizeIssues(issues []Issue) Summary {
	summary := Summary{}
	for _, issue := range issues {
		summary.Total++
		switch issue.Severity {
		case SeverityError:
			summary.Error++
		case SeverityWarn:
			summary.Warn++
		case SeverityInfo:
			summary.Info++
		}
	}
	return summary
}

func sortIssues(issues []Issue) {
	sort.SliceStable(issues, func(i, j int) bool {
		left := issues[i]
		right := issues[j]
		if severityRank(left.Severity) != severityRank(right.Severity) {
			return severityRank(left.Severity) < severityRank(right.Severity)
		}
		if left.RuleID != right.RuleID {
			return left.RuleID < right.RuleID
		}
		leftPath := sortPathKey(primaryPath(left.Paths))
		rightPath := sortPathKey(primaryPath(right.Paths))
		if leftPath != rightPath {
			return leftPath < rightPath
		}
		leftTool := primaryTool(left.Tools)
		rightTool := primaryTool(right.Tools)
		if leftTool != rightTool {
			return leftTool < rightTool
		}
		return left.Title < right.Title
	})
}

func severityRank(severity Severity) int {
	switch severity {
	case SeverityError:
		return 0
	case SeverityWarn:
		return 1
	case SeverityInfo:
		return 2
	default:
		return 3
	}
}

func primaryPath(paths []string) string {
	if len(paths) == 0 {
		return ""
	}
	return paths[0]
}

func primaryTool(tools []string) string {
	if len(tools) == 0 {
		return ""
	}
	return tools[0]
}

func sortPathKey(path string) string {
	return filepath.ToSlash(path)
}
