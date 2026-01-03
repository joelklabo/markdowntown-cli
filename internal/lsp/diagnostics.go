package lsp

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"markdowntown-cli/internal/audit"

	protocol "github.com/tliron/glsp/protocol_3_16"
)

const (
	// relatedConfigLimit caps per-issue related config locations to avoid noisy diagnostics.
	relatedConfigLimit = 3
	// relatedInfoLimit caps total related info entries (suggestions/tools/evidence + configs).
	relatedInfoLimit = 8
)

func diagnosticForIssue(issue audit.Issue, uri string, path string, repoRoot string, includeRelatedInfo bool, includeEvidence bool, includeTags bool, includeCodeDescription bool) protocol.Diagnostic {
	code := protocol.IntegerOrString{Value: issue.RuleID}
	source := serverName
	message := issue.Message
	if issue.Title != "" && !strings.HasPrefix(issue.Message, issue.Title) {
		message = fmt.Sprintf("%s: %s", issue.Title, issue.Message)
	}

	diag := protocol.Diagnostic{
		Range:    issueToProtocolRange(issue.Range),
		Severity: severityToProtocolSeverity(issue.Severity),
		Code:     &code,
		Source:   &source,
		Message:  message,
		Data:     buildDiagnosticData(issue, includeEvidence),
	}

	if includeCodeDescription {
		if meta := issueRuleData(issue); meta != nil && meta.DocURL != "" {
			if desc := diagnosticCodeDescription(meta.DocURL, repoRoot); desc != nil {
				diag.CodeDescription = desc
			}
		}
	}
	if includeTags {
		if tags := diagnosticTags(issue); len(tags) > 0 {
			diag.Tags = tags
		}
	}
	if includeRelatedInfo {
		related := buildRelatedInfo(issue, uri, path, repoRoot, diag.Range, includeEvidence)
		if len(related) > 0 {
			diag.RelatedInformation = related
		}
	}
	return diag
}

func buildRelatedInfo(issue audit.Issue, uri string, path string, repoRoot string, rng protocol.Range, includeEvidence bool) []protocol.DiagnosticRelatedInformation {
	related := make([]protocol.DiagnosticRelatedInformation, 0)
	add := func(targetURI string, targetRange protocol.Range, message string) {
		if message == "" || len(related) >= relatedInfoLimit {
			return
		}
		related = append(related, protocol.DiagnosticRelatedInformation{
			Location: protocol.Location{
				URI:   targetURI,
				Range: targetRange,
			},
			Message: message,
		})
	}
	addCurrent := func(message string) {
		add(uri, rng, message)
	}

	if issue.Suggestion != "" {
		addCurrent("Suggestion: " + issue.Suggestion)
	}
	if tools := formatTools(issue.Tools); tools != "" {
		addCurrent("Tools: " + tools)
	}
	for _, config := range relatedConfigs(issue.Paths, path, repoRoot, relatedConfigLimit) {
		add(config.uri, config.rng, config.message)
	}
	if includeEvidence {
		if evidence := formatEvidence(issue.Evidence); evidence != "" {
			addCurrent("Evidence: " + evidence)
		}
	}

	return related
}

type relatedConfigInfo struct {
	uri     string
	rng     protocol.Range
	message string
}

func relatedConfigs(paths []audit.Path, currentPath string, repoRoot string, limit int) []relatedConfigInfo {
	if len(paths) == 0 || limit <= 0 {
		return nil
	}
	current := normalizeIssuePath(currentPath, repoRoot)
	seen := make(map[string]struct{})
	capacity := limit
	if len(paths) < capacity {
		capacity = len(paths)
	}
	related := make([]relatedConfigInfo, 0, capacity)
	for _, item := range paths {
		if item.Path == "" || item.Redacted {
			continue
		}
		absolute := resolveIssuePath(item.Path, repoRoot)
		if absolute == "" {
			continue
		}
		if current != "" && absolute == current {
			continue
		}
		if _, ok := seen[absolute]; ok {
			continue
		}
		seen[absolute] = struct{}{}
		related = append(related, relatedConfigInfo{
			uri:     pathToURL(absolute),
			rng:     protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
			message: relatedConfigMessage(item),
		})
		if len(related) >= limit {
			break
		}
	}
	return related
}

func resolveIssuePath(path string, repoRoot string) string {
	if path == "" {
		return ""
	}
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	if repoRoot == "" {
		return ""
	}
	return filepath.Clean(filepath.Join(repoRoot, filepath.FromSlash(path)))
}

func normalizeIssuePath(path string, repoRoot string) string {
	return resolveIssuePath(path, repoRoot)
}

func relatedConfigMessage(path audit.Path) string {
	if path.Scope != "" {
		return fmt.Sprintf("Related config (%s): %s", path.Scope, path.Path)
	}
	return fmt.Sprintf("Related config: %s", path.Path)
}

func buildDiagnosticData(issue audit.Issue, includeEvidence bool) map[string]any {
	data := map[string]any{
		"ruleId":     issue.RuleID,
		"title":      issue.Title,
		"suggestion": issue.Suggestion,
		"paths":      issue.Paths,
		"tools":      issue.Tools,
	}
	if includeEvidence {
		data["evidence"] = issue.Evidence
	}
	return data
}

func issueRuleData(issue audit.Issue) *audit.RuleData {
	switch typed := issue.Data.(type) {
	case audit.RuleData:
		return &typed
	case *audit.RuleData:
		return typed
	default:
		return nil
	}
}

func diagnosticTags(issue audit.Issue) []protocol.DiagnosticTag {
	meta := issueRuleData(issue)
	if meta == nil || len(meta.Tags) == 0 {
		return nil
	}
	tags := make([]protocol.DiagnosticTag, 0, len(meta.Tags))
	seen := make(map[protocol.DiagnosticTag]struct{})
	for _, tag := range meta.Tags {
		switch strings.ToLower(tag) {
		case "unnecessary":
			seen[protocol.DiagnosticTagUnnecessary] = struct{}{}
		case "deprecated":
			seen[protocol.DiagnosticTagDeprecated] = struct{}{}
		}
	}
	for tag := range seen {
		tags = append(tags, tag)
	}
	sort.Slice(tags, func(i, j int) bool {
		return tags[i] < tags[j]
	})
	return tags
}

func diagnosticCodeDescription(docURL string, repoRoot string) *protocol.CodeDescription {
	docURL = strings.TrimSpace(docURL)
	if docURL == "" {
		return nil
	}
	href := docURL
	if !strings.Contains(docURL, "://") && repoRoot != "" {
		path := filepath.Join(repoRoot, filepath.FromSlash(docURL))
		href = pathToURL(path)
	}
	return &protocol.CodeDescription{HRef: href}
}

func formatTools(tools []audit.Tool) string {
	if len(tools) == 0 {
		return ""
	}
	items := make([]string, 0, len(tools))
	for _, tool := range tools {
		if tool.ToolID == "" && tool.Kind == "" {
			continue
		}
		if tool.ToolID != "" && tool.Kind != "" {
			items = append(items, fmt.Sprintf("%s (%s)", tool.ToolID, tool.Kind))
			continue
		}
		if tool.ToolID != "" {
			items = append(items, tool.ToolID)
			continue
		}
		if tool.Kind != "" {
			items = append(items, tool.Kind)
		}
	}
	return strings.Join(items, ", ")
}

func formatEvidence(evidence map[string]any) string {
	if len(evidence) == 0 {
		return ""
	}
	keys := make([]string, 0, len(evidence))
	for key := range evidence {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		value := formatEvidenceValue(evidence[key])
		if value == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s=%s", key, value))
	}
	return strings.Join(parts, ", ")
}

func formatEvidenceValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case bool:
		return fmt.Sprintf("%t", typed)
	case int, int8, int16, int32, int64:
		return fmt.Sprintf("%d", typed)
	case uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", typed)
	case float32, float64:
		return fmt.Sprintf("%v", typed)
	case []string:
		return joinWithLimit(typed, 3)
	case []any:
		items := make([]string, 0, len(typed))
		for _, item := range typed {
			switch v := item.(type) {
			case string:
				if v != "" {
					items = append(items, v)
				}
			default:
				if item != nil {
					items = append(items, fmt.Sprintf("%v", item))
				}
			}
		}
		return joinWithLimit(items, 3)
	}
	return fmt.Sprintf("%v", value)
}

func joinWithLimit(items []string, limit int) string {
	if len(items) == 0 {
		return ""
	}
	if limit <= 0 || len(items) <= limit {
		return strings.Join(items, ", ")
	}
	extra := len(items) - limit
	return strings.Join(items[:limit], ", ") + fmt.Sprintf(" (+%d more)", extra)
}
