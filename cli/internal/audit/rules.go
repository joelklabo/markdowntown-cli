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

// Evaluate runs the rule for the provided context.
func (r Rule) Evaluate(ctx Context) []Issue {
	return r.Run(ctx)
}

const ruleDocURL = "docs/audit-spec-v1.md"

var ruleMetadata = map[string]RuleData{
	"MD001": {Category: "conflict", DocURL: ruleDocURL},
	"MD002": {Category: "scope", DocURL: ruleDocURL, Tags: []string{"unnecessary"}, QuickFixes: []string{"allow-gitignore"}},
	"MD003": {Category: "validity", DocURL: ruleDocURL, QuickFixes: []string{"remove-frontmatter"}},
	"MD004": {Category: "content", DocURL: ruleDocURL, Tags: []string{"unnecessary"}, QuickFixes: []string{"insert-placeholder"}},
	"MD005": {Category: "scope", DocURL: ruleDocURL, QuickFixes: []string{"create-repo-config"}},
	"MD006": {Category: "validity", DocURL: ruleDocURL},
	"MD007": {Category: "conflict", DocURL: ruleDocURL, QuickFixes: []string{"remove-duplicate-frontmatter"}},
	"MD008": {Category: "discovery", DocURL: ruleDocURL},
	"MD009": {Category: "discovery", DocURL: ruleDocURL},
	"MD010": {Category: "discovery", DocURL: ruleDocURL},
	"MD011": {Category: "content", DocURL: ruleDocURL, Tags: []string{"unnecessary"}},
	"MD012": {Category: "validity", DocURL: ruleDocURL, QuickFixes: []string{"insert-frontmatter-id"}},
	"MD018": {Category: "content", DocURL: ruleDocURL},
	"MD013": {Category: "scope", DocURL: ruleDocURL, Tags: []string{"unnecessary"}},
}

func ruleData(ruleID string) any {
	if meta, ok := ruleMetadata[ruleID]; ok {
		return meta
	}
	return nil
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
		{ID: "MD008", Severity: SeverityWarning, Run: ruleCircularSymlink},
		{ID: "MD009", Severity: SeverityInfo, Run: ruleUnrecognizedStdin},
		{ID: "MD010", Severity: SeverityWarning, Run: ruleScanWarning},
		{ID: "MD011", Severity: SeverityWarning, Run: ruleBinaryContent},
		{ID: "MD012", Severity: SeverityWarning, Run: ruleMissingFrontmatterID},
		{ID: "MD018", Severity: SeverityWarning, Run: ruleOversizedConfig},
		{ID: "MD013", Severity: SeverityInfo, Run: ruleShadowedConfig},
	}
}

// RunRules executes the provided rules and returns the aggregated issues.
func RunRules(ctx Context, rules []Rule) []Issue {
	var issues []Issue
	for _, rule := range rules {
		issues = append(issues, rule.Evaluate(ctx)...)
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

		message := fmt.Sprintf("Conflicting configs for %s (%s) in %s scope.", key.ToolID, key.Kind, key.Scope)
		suggestion := "Keep exactly one config for this tool/kind/scope. Delete or rename extras, or use a documented override pair."

		// Check if any paths appear to be build output or test fixtures
		buildPaths := countBuildOutputPaths(paths)
		testPaths := countTestOrExamplePaths(paths)
		nonProductionPaths := buildPaths + testPaths

		if nonProductionPaths > 0 {
			var parts []string
			if buildPaths > 0 {
				parts = append(parts, fmt.Sprintf("%d build output", buildPaths))
			}
			if testPaths > 0 {
				parts = append(parts, fmt.Sprintf("%d test/example", testPaths))
			}
			message = fmt.Sprintf("Conflicting configs for %s (%s) in %s scope (%s of %d paths are likely not production configs).",
				key.ToolID, key.Kind, key.Scope, strings.Join(parts, ", "), len(paths))

			// Provide more specific suggestions based on what we found
			switch {
			case buildPaths > 0 && testPaths == 0:
				suggestion = "Some paths are in build output directories (e.g., .next/, dist/). These are usually gitignored; verify they aren't tracked."
			case testPaths > 0 && buildPaths == 0:
				suggestion = "Some paths look like test fixtures or examples. Consider excluding test directories from the scan, or keep exactly one real config."
			default:
				suggestion = "Some paths are build output or test fixtures. Consider excluding these directories from the scan."
			}
		}

		evidence := map[string]any{
			"scope":  key.Scope,
			"toolId": key.ToolID,
			"kind":   key.Kind,
		}
		if buildPaths > 0 {
			evidence["buildOutputPaths"] = buildPaths
		}
		if testPaths > 0 {
			evidence["testFixturePaths"] = testPaths
		}

		issue := Issue{
			RuleID:     "MD001",
			Severity:   SeverityError,
			Title:      "Config conflict",
			Message:    message,
			Suggestion: suggestion,
			Paths:      issuePaths,
			Tools:      []Tool{{ToolID: key.ToolID, Kind: key.Kind}},
			Data:       ruleData("MD001"),
			Evidence:   evidence,
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
			Data:       ruleData("MD007"),
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
			Data:       ruleData("MD002"),
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
			Data:       ruleData("MD003"),
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
				issue.Range = &scan.Range{
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
			Data:       ruleData("MD004"),
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
			Data:       ruleData("MD005"),
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
			Data:       ruleData("MD006"),
			Evidence: map[string]any{
				"error": err,
			},
		}
		issues = append(issues, issue)
	}
	return issues
}

func ruleCircularSymlink(ctx Context) []Issue {
	warnings := warningsByCode(ctx.Scan.Warnings, "CIRCULAR_SYMLINK")
	return warningIssues(ctx, warnings, "MD008", SeverityWarning, "Circular symlink", "Circular symlink detected during scan.", "Break the symlink loop or remove the entry.")
}

func ruleUnrecognizedStdin(ctx Context) []Issue {
	warnings := warningsByCode(ctx.Scan.Warnings, "UNRECOGNIZED_STDIN")
	return warningIssues(ctx, warnings, "MD009", SeverityInfo, "Unrecognized stdin path", "Stdin path did not match any registry pattern.", "Add a registry pattern for this path or remove it from stdin.")
}

func ruleScanWarning(ctx Context) []Issue {
	warnings := warningsByCode(ctx.Scan.Warnings, "EACCES", "ERROR", "ENOENT")
	return scanWarningIssues(ctx, warnings)
}

func scanWarningIssues(ctx Context, warnings []scan.Warning) []Issue {
	if len(warnings) == 0 {
		return nil
	}

	// Group stale symlink warnings by their missing target path
	type groupKey struct {
		targetPath string
		code       string
	}
	groups := make(map[groupKey][]scan.Warning)
	var ungrouped []scan.Warning

	for _, warning := range warnings {
		target := extractMissingTarget(warning.Message)
		if target != "" && (warning.Code == "ENOENT" || warning.Code == "ERROR") {
			key := groupKey{targetPath: target, code: warning.Code}
			groups[key] = append(groups[key], warning)
		} else {
			ungrouped = append(ungrouped, warning)
		}
	}

	issues := make([]Issue, 0, len(groups)+len(ungrouped))

	// Emit grouped issues (one per missing target)
	for key, groupedWarnings := range groups {
		paths := make([]Path, 0, len(groupedWarnings))
		for _, w := range groupedWarnings {
			paths = append(paths, warningPaths(ctx, w.Path)...)
		}

		suggestion := "Verify permissions and registry paths, then re-run the scan."
		isNodeModules := false
		for _, w := range groupedWarnings {
			if strings.Contains(w.Path, "node_modules") {
				isNodeModules = true
				break
			}
		}
		if isNodeModules {
			suggestion = fmt.Sprintf(
				"This appears to be %d stale symlink(s) to a removed package. Run `pnpm install` or `npm install` to regenerate node_modules.",
				len(groupedWarnings),
			)
		}

		plural := ""
		if len(groupedWarnings) > 1 {
			plural = "s"
		}
		message := fmt.Sprintf("Missing target: %s (%d symlink%s affected)", key.targetPath, len(groupedWarnings), plural)

		issue := Issue{
			RuleID:     "MD010",
			Severity:   SeverityWarning,
			Title:      "Stale symlinks",
			Message:    message,
			Suggestion: suggestion,
			Paths:      paths,
			Data:       ruleData("MD010"),
			Evidence: map[string]any{
				"warningCode":   key.code,
				"missingTarget": key.targetPath,
				"affectedCount": len(groupedWarnings),
			},
		}
		issues = append(issues, issue)
	}

	// Emit ungrouped warnings as before (one issue each)
	for _, warning := range ungrouped {
		suggestion := "Verify permissions and registry paths, then re-run the scan."
		evidence := map[string]any{
			"warningCode": warning.Code,
		}
		if warning.Message != "" {
			evidence["warningMessage"] = warning.Message
		}
		issue := Issue{
			RuleID:     "MD010",
			Severity:   SeverityWarning,
			Title:      "Scan warning",
			Message:    warning.Message,
			Suggestion: suggestion,
			Paths:      warningPaths(ctx, warning.Path),
			Data:       ruleData("MD010"),
			Evidence:   evidence,
		}
		issues = append(issues, issue)
	}

	return issues
}

// extractMissingTarget extracts the missing path from "lstat <path>: no such file or directory" messages.
func extractMissingTarget(message string) string {
	if !strings.HasPrefix(message, "lstat ") {
		return ""
	}
	const suffix = ": no such file or directory"
	if !strings.HasSuffix(message, suffix) {
		return ""
	}
	start := len("lstat ")
	end := len(message) - len(suffix)
	if start >= end {
		return ""
	}
	return message[start:end]
}

func ruleBinaryContent(ctx Context) []Issue {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		if entry.ContentSkipped == nil || *entry.ContentSkipped != "binary" {
			continue
		}
		evidence := map[string]any{
			"contentSkipped": *entry.ContentSkipped,
		}
		if entry.SizeBytes != nil {
			evidence["sizeBytes"] = *entry.SizeBytes
		}
		issue := Issue{
			RuleID:     "MD011",
			Severity:   SeverityWarning,
			Title:      "Binary config content",
			Message:    "Binary config content was skipped.",
			Suggestion: "Replace the file with text instructions or remove it.",
			Paths:      []Path{redactPath(ctx, entry.Path, entry.Scope)},
			Tools:      toolsForEntry(entry),
			Data:       ruleData("MD011"),
			Evidence:   evidence,
		}
		issues = append(issues, issue)
	}
	return issues
}

func ruleMissingFrontmatterID(ctx Context) []Issue {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		if len(entry.Tools) == 0 {
			continue
		}
		for _, tool := range entry.Tools {
			keys := frontmatterConflictKeys(tool.Kind)
			if len(keys) == 0 {
				continue
			}
			if hasFrontmatterIdentifier(entry.Frontmatter, keys) {
				continue
			}
			suggestion := fmt.Sprintf("Add one of: %s.", strings.Join(keys, ", "))
			issue := Issue{
				RuleID:     "MD012",
				Severity:   SeverityWarning,
				Title:      "Missing frontmatter identifier",
				Message:    fmt.Sprintf("Missing required frontmatter identifier for %s (%s).", tool.ToolID, tool.Kind),
				Suggestion: suggestion,
				Paths:      []Path{redactPath(ctx, entry.Path, entry.Scope)},
				Tools:      []Tool{{ToolID: tool.ToolID, Kind: tool.Kind}},
				Data:       ruleData("MD012"),
				Evidence: map[string]any{
					"requiredKeys": keys,
					"toolId":       tool.ToolID,
					"kind":         tool.Kind,
				},
			}
			issues = append(issues, issue)
		}
	}
	return issues
}

func hasFrontmatterIdentifier(frontmatter map[string]any, keys []string) bool {
	for _, key := range keys {
		if len(frontmatterValues(frontmatter, key)) > 0 {
			return true
		}
	}
	return false
}

// oversizedThreshold is 1MB - AI config files should typically be small instruction files.
const oversizedThreshold int64 = 1024 * 1024

func ruleOversizedConfig(ctx Context) []Issue {
	var issues []Issue
	for _, entry := range ctx.Scan.Configs {
		if entry.SizeBytes == nil {
			continue
		}
		if *entry.SizeBytes < oversizedThreshold {
			continue
		}
		sizeKB := *entry.SizeBytes / 1024
		sizeMB := float64(*entry.SizeBytes) / (1024 * 1024)
		message := fmt.Sprintf("Config file is unusually large (%d KB).", sizeKB)
		if sizeMB >= 1 {
			message = fmt.Sprintf("Config file is unusually large (%.1f MB).", sizeMB)
		}
		issue := Issue{
			RuleID:     "MD018",
			Severity:   SeverityWarning,
			Title:      "Oversized config file",
			Message:    message,
			Suggestion: "Review the file contents. Large config files may indicate accidental inclusion of data or logs.",
			Paths:      []Path{redactPath(ctx, entry.Path, entry.Scope)},
			Tools:      toolsForEntry(entry),
			Data:       ruleData("MD018"),
			Evidence: map[string]any{
				"sizeBytes": *entry.SizeBytes,
				"threshold": oversizedThreshold,
			},
		}
		issues = append(issues, issue)
	}
	return issues
}

func warningIssues(ctx Context, warnings []scan.Warning, ruleID string, severity Severity, title, defaultMessage, suggestion string) []Issue {
	if len(warnings) == 0 {
		return nil
	}
	issues := make([]Issue, 0, len(warnings))
	for _, warning := range warnings {
		message := defaultMessage
		if strings.TrimSpace(warning.Message) != "" {
			message = warning.Message
		}
		evidence := map[string]any{
			"warningCode": warning.Code,
		}
		if warning.Message != "" {
			evidence["warningMessage"] = warning.Message
		}
		issue := Issue{
			RuleID:     ruleID,
			Severity:   severity,
			Title:      title,
			Message:    message,
			Suggestion: suggestion,
			Paths:      warningPaths(ctx, warning.Path),
			Data:       ruleData(ruleID),
			Evidence:   evidence,
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

// buildOutputPatterns matches common build artifact directories.
var buildOutputPatterns = []string{
	"/.next/",         // Next.js build output
	"/dist/",          // Common JS/TS build output
	"/build/",         // Common build output
	"/out/",           // Next.js export output
	"/.output/",       // Nuxt/Nitro output
	"/.turbo/",        // Turborepo cache
	"/.vercel/",       // Vercel deployment artifacts
	"/target/",        // Rust/Java build output
	"/vendor/",        // Go vendor directory
	"/_site/",         // Jekyll/Hugo output
	"/.cache/",        // Various build caches
	"/.parcel-cache/", // Parcel cache
}

// testOrExamplePatterns matches common test fixture and example directory patterns.
var testOrExamplePatterns = []string{
	"/testdata/",
	"/test/",
	"/tests/",
	"/__tests__/",
	"/fixtures/",
	"/examples/",
	"/example/",
	"/__fixtures__/",
	"/__mocks__/",
}

// countBuildOutputPaths returns the number of paths that appear to be build output.
func countBuildOutputPaths(paths []string) int {
	count := 0
	for _, p := range paths {
		normalized := strings.ToLower(p)
		for _, pattern := range buildOutputPatterns {
			if strings.Contains(normalized, pattern) {
				count++
				break
			}
		}
	}
	return count
}

// isBuildOutputPath returns true if the path appears to be in a build output directory.
func isBuildOutputPath(path string) bool {
	normalized := strings.ToLower(path)
	for _, pattern := range buildOutputPatterns {
		if strings.Contains(normalized, pattern) {
			return true
		}
	}
	return false
}

// countTestOrExamplePaths returns the number of paths that appear to be test fixtures or examples.
// Excludes paths that are already identified as build output.
func countTestOrExamplePaths(paths []string) int {
	count := 0
	for _, p := range paths {
		// Skip build output to avoid double counting
		if isBuildOutputPath(p) {
			continue
		}
		normalized := strings.ToLower(p)
		for _, pattern := range testOrExamplePatterns {
			if strings.Contains(normalized, pattern) {
				count++
				break
			}
		}
	}
	return count
}

// ruleShadowedConfig detects configs shadowed by higher-precedence files based on loadBehavior.
// Scope precedence: repo > user > global
func ruleShadowedConfig(ctx Context) []Issue {
	// Group configs by tool/kind, tracking all entries for shadowing analysis
	type toolKindGroup struct {
		entries []scan.ConfigEntry
	}

	groups := make(map[toolKindKey]toolKindGroup)
	for _, entry := range ctx.Scan.Configs {
		for _, tool := range entry.Tools {
			// Only check configs with loadBehavior that implies shadowing
			if !isShadowingLoadBehavior(tool.LoadBehavior) {
				continue
			}
			key := toolKindKey{ToolID: tool.ToolID, Kind: tool.Kind}
			group := groups[key]
			group.entries = append(group.entries, entry)
			groups[key] = group
		}
	}

	var issues []Issue
	for key, group := range groups {
		if len(group.entries) <= 1 {
			continue
		}

		// Find the highest precedence entry for this tool/kind
		var highestEntry *scan.ConfigEntry
		var highestPrecedence = -1
		for i := range group.entries {
			entry := &group.entries[i]
			precedence := scopePrecedence(entry.Scope)
			if precedence > highestPrecedence {
				highestPrecedence = precedence
				highestEntry = entry
			}
		}

		if highestEntry == nil {
			continue
		}

		// Find loadBehavior for this tool/kind from the highest entry
		var loadBehavior string
		for _, tool := range highestEntry.Tools {
			if tool.ToolID == key.ToolID && tool.Kind == key.Kind {
				loadBehavior = tool.LoadBehavior
				break
			}
		}

		// Emit issues for all shadowed entries
		for i := range group.entries {
			entry := &group.entries[i]
			if entry.Path == highestEntry.Path {
				continue
			}

			entryPrecedence := scopePrecedence(entry.Scope)
			if entryPrecedence >= highestPrecedence {
				continue
			}

			issue := Issue{
				RuleID:     "MD013",
				Severity:   SeverityInfo,
				Title:      "Shadowed config",
				Message:    fmt.Sprintf("Config for %s (%s) is shadowed by a higher-precedence %s-scope config.", key.ToolID, key.Kind, highestEntry.Scope),
				Suggestion: "Remove this config or move it to a higher-precedence scope if the instructions are needed.",
				Paths:      []Path{redactPath(ctx, entry.Path, entry.Scope)},
				Tools:      []Tool{{ToolID: key.ToolID, Kind: key.Kind}},
				Data:       ruleData("MD013"),
				Evidence: map[string]any{
					"shadowedBy":   redactPath(ctx, highestEntry.Path, highestEntry.Scope).Path,
					"loadBehavior": loadBehavior,
				},
			}
			issues = append(issues, issue)
		}
	}

	// Sort issues for deterministic output
	sort.SliceStable(issues, func(i, j int) bool {
		if issues[i].Tools[0].ToolID != issues[j].Tools[0].ToolID {
			return issues[i].Tools[0].ToolID < issues[j].Tools[0].ToolID
		}
		if issues[i].Tools[0].Kind != issues[j].Tools[0].Kind {
			return issues[i].Tools[0].Kind < issues[j].Tools[0].Kind
		}
		return issues[i].Paths[0].Path < issues[j].Paths[0].Path
	})

	return issues
}

// isShadowingLoadBehavior returns true if the loadBehavior implies shadowing.
// "nearest-ancestor" and "single" mean only one config is used.
func isShadowingLoadBehavior(behavior string) bool {
	switch strings.ToLower(behavior) {
	case "nearest-ancestor", "single":
		return true
	default:
		return false
	}
}

// scopePrecedence returns the precedence level for a scope.
// Higher values indicate higher precedence (repo overrides user overrides global).
func scopePrecedence(scope string) int {
	switch scope {
	case scan.ScopeRepo:
		return 2
	case scan.ScopeUser:
		return 1
	case scan.ScopeGlobal:
		return 0
	default:
		return -1
	}
}
