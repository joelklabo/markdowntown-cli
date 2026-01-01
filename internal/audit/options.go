package audit

import (
	"fmt"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"markdowntown-cli/internal/scan"
)

// ParseSeverity validates a severity string.
func ParseSeverity(value string) (Severity, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case string(SeverityError):
		return SeverityError, nil
	case string(SeverityWarning):
		return SeverityWarning, nil
	case string(SeverityInfo):
		return SeverityInfo, nil
	default:
		return "", fmt.Errorf("invalid severity: %s", value)
	}
}

// ParseRedactMode validates a redaction mode string.
func ParseRedactMode(value string) (RedactMode, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case string(RedactAuto):
		return RedactAuto, nil
	case string(RedactAlways):
		return RedactAlways, nil
	case string(RedactNever):
		return RedactNever, nil
	default:
		return "", fmt.Errorf("invalid redaction mode: %s", value)
	}
}

// FilterRules applies --only and --ignore-rule filters to the provided rules.
func FilterRules(rules []Rule, onlyValues, ignoreValues []string) ([]Rule, error) {
	allowed := make(map[string]Rule, len(rules))
	for _, rule := range rules {
		allowed[strings.ToUpper(rule.ID)] = rule
	}

	only := toRuleSet(normalizeRuleIDs(onlyValues))
	ignore := toRuleSet(normalizeRuleIDs(ignoreValues))

	if err := validateRuleSet(allowed, only); err != nil {
		return nil, err
	}
	if err := validateRuleSet(allowed, ignore); err != nil {
		return nil, err
	}

	filtered := make([]Rule, 0, len(rules))
	for _, rule := range rules {
		id := strings.ToUpper(rule.ID)
		if len(only) > 0 {
			if _, ok := only[id]; !ok {
				continue
			}
		}
		if _, ok := ignore[id]; ok {
			continue
		}
		filtered = append(filtered, rule)
	}
	return filtered, nil
}

// FilterOutput removes configs and warnings that match excluded path globs.
func FilterOutput(output scan.Output, exclude []string) (scan.Output, error) {
	patterns := normalizePatterns(exclude)
	if len(patterns) == 0 {
		return output, nil
	}

	repoRoot := output.RepoRoot
	configs := make([]scan.ConfigEntry, 0, len(output.Configs))
	for _, entry := range output.Configs {
		match, err := matchesAnyPattern(entry.Path, repoRoot, patterns)
		if err != nil {
			return output, err
		}
		if !match {
			configs = append(configs, entry)
		}
	}
	output.Configs = configs

	if len(output.Warnings) == 0 {
		return output, nil
	}

	warnings := make([]scan.Warning, 0, len(output.Warnings))
	for _, warning := range output.Warnings {
		if warning.Path == "" {
			warnings = append(warnings, warning)
			continue
		}
		match, err := matchesAnyPattern(warning.Path, repoRoot, patterns)
		if err != nil {
			return output, err
		}
		if !match {
			warnings = append(warnings, warning)
		}
	}
	output.Warnings = warnings
	return output, nil
}

// BuildSummary produces summary counts and rules fired.
func BuildSummary(issues []Issue) Summary {
	counts := SeverityCounts{}
	rules := make(map[string]struct{})
	for _, issue := range issues {
		switch issue.Severity {
		case SeverityError:
			counts.Error++
		case SeverityWarning:
			counts.Warning++
		case SeverityInfo:
			counts.Info++
		}
		if issue.RuleID != "" {
			rules[issue.RuleID] = struct{}{}
		}
	}

	ruleIDs := make([]string, 0, len(rules))
	for ruleID := range rules {
		ruleIDs = append(ruleIDs, ruleID)
	}
	sort.Strings(ruleIDs)

	return Summary{
		IssueCounts: counts,
		RulesFired:  ruleIDs,
	}
}

// ShouldFail returns true when issues meet or exceed the threshold severity.
func ShouldFail(issues []Issue, threshold Severity) bool {
	thresholdRank := SeverityRank(threshold)
	for _, issue := range issues {
		if SeverityRank(issue.Severity) <= thresholdRank {
			return true
		}
	}
	return false
}

// BuildScanWarnings returns warnings safe for audit output.
func BuildScanWarnings(warnings []scan.Warning, issues []Issue, redactor *Redactor, repoRoot string) []ScanWarning {
	if len(warnings) == 0 {
		return nil
	}
	conflictIssue := hasRuleID(issues, "MD001")

	output := make([]ScanWarning, 0, len(warnings))
	for _, warning := range warnings {
		if conflictIssue && warning.Code == "CONFIG_CONFLICT" {
			continue
		}
		pathValue := warning.Path
		if redactor != nil && warning.Path != "" {
			pathValue = redactWarningPath(redactor, repoRoot, warning.Path)
		}
		output = append(output, ScanWarning{
			Path:    pathValue,
			Code:    warning.Code,
			Message: warning.Message,
		})
	}
	return output
}

func normalizeRuleIDs(values []string) []string {
	parts := make([]string, 0, len(values))
	for _, value := range values {
		for _, piece := range strings.Split(value, ",") {
			piece = strings.TrimSpace(piece)
			if piece == "" {
				continue
			}
			parts = append(parts, strings.ToUpper(piece))
		}
	}
	return parts
}

func toRuleSet(values []string) map[string]struct{} {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		set[value] = struct{}{}
	}
	return set
}

func validateRuleSet(allowed map[string]Rule, values map[string]struct{}) error {
	for value := range values {
		if _, ok := allowed[value]; !ok {
			return fmt.Errorf("unknown rule id: %s", value)
		}
	}
	return nil
}

func normalizePatterns(patterns []string) []string {
	out := make([]string, 0, len(patterns))
	for _, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		out = append(out, filepath.ToSlash(pattern))
	}
	return out
}

func matchesAnyPattern(rawPath, repoRoot string, patterns []string) (bool, error) {
	candidates := pathCandidates(rawPath, repoRoot)
	for _, pattern := range patterns {
		for _, candidate := range candidates {
			ok, err := path.Match(pattern, candidate)
			if err != nil {
				return false, err
			}
			if ok {
				return true, nil
			}
		}
	}
	return false, nil
}

func pathCandidates(rawPath, repoRoot string) []string {
	pathValue := filepath.Clean(rawPath)
	if !filepath.IsAbs(pathValue) {
		if resolved, err := filepath.Abs(pathValue); err == nil {
			pathValue = resolved
		}
	}
	normAbs := normalizePath(pathValue)
	candidates := []string{normAbs}

	if repoRoot != "" {
		if rel, ok := relativePath(repoRoot, pathValue); ok {
			if rel == "." {
				candidates = append(candidates, "./")
			} else {
				rel = normalizePath(rel)
				candidates = append(candidates, "./"+rel, rel)
			}
		}
	}

	return sortStringUnique(candidates)
}

func redactWarningPath(redactor *Redactor, repoRoot, rawPath string) string {
	pathValue := filepath.Clean(rawPath)
	if !filepath.IsAbs(pathValue) {
		if resolved, err := filepath.Abs(pathValue); err == nil {
			pathValue = resolved
		}
	}

	scope := "user"
	if repoRoot != "" {
		root := filepath.Clean(repoRoot)
		if isWithin(pathValue, root) {
			scope = "repo"
		}
	}

	return redactor.RedactPath(pathValue, scope).Path
}

func hasRuleID(issues []Issue, ruleID string) bool {
	for _, issue := range issues {
		if issue.RuleID == ruleID {
			return true
		}
	}
	return false
}
