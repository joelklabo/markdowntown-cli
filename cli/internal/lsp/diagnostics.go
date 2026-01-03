package lsp

import (
	"fmt"
	"net/url"
	"path"
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
	// docsBaseURL is used to turn relative doc URLs into HTTPS links.
	docsBaseURL = "https://github.com/joelklabo/markdowntown-cli/blob/main/"
	// lspDocURL points to the LSP-focused diagnostic catalog.
	lspDocURL = "docs/architecture/diagnostic-catalog.md"
)

var lspRuleMetadata = map[string]audit.RuleData{
	"MD000": {Category: "registry", DocURL: lspDocURL},
	"MD015": {Category: "validity", DocURL: lspDocURL, QuickFixes: []string{quickFixReplaceToolID}},
}

func diagnosticForIssue(issue audit.Issue, uri string, path string, repoRoot string, includeRelatedInfo bool, includeEvidence bool, includeTags bool, includeCodeDescription bool, redactMode audit.RedactMode) protocol.Diagnostic {
	code := protocol.IntegerOrString{Value: issue.RuleID}
	source := serverName
	message := diagnosticMessage(issue)

	diag := protocol.Diagnostic{
		Range:    issueToProtocolRange(issue.Range),
		Severity: severityToProtocolSeverity(issue.Severity),
		Code:     &code,
		Source:   &source,
		Message:  message,
		Data:     buildDiagnosticData(issue, includeEvidence, redactMode),
	}

	if includeCodeDescription {
		if meta := issueRuleData(issue); meta != nil && meta.DocURL != "" {
			if desc := diagnosticCodeDescription(meta.DocURL); desc != nil {
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
		related := buildRelatedInfo(issue, uri, path, repoRoot, diag.Range, includeEvidence, redactMode)
		if len(related) > 0 {
			diag.RelatedInformation = related
		}
	}
	return diag
}

func diagnosticMessage(issue audit.Issue) string {
	message := issue.Message
	if issue.Title != "" && !strings.HasPrefix(issue.Message, issue.Title) {
		message = fmt.Sprintf("%s: %s", issue.Title, issue.Message)
	}
	detail := diagnosticDetail(issue)
	if detail == "" || strings.Contains(message, detail) {
		return message
	}
	message = strings.TrimSpace(message)
	message = strings.TrimSuffix(message, ".")
	return fmt.Sprintf("%s (%s)", message, detail)
}

func diagnosticDetail(issue audit.Issue) string {
	switch issue.RuleID {
	case "MD003":
		return issueEvidenceString(issue, "frontmatterError")
	case "MD006":
		return issueEvidenceString(issue, "error")
	case "MD008", "MD009", "MD010":
		return issueEvidenceString(issue, "warningCode")
	case "MD011":
		return issueEvidenceString(issue, "contentSkipped")
	default:
		return ""
	}
}

func issueEvidenceString(issue audit.Issue, key string) string {
	if issue.Evidence == nil {
		return ""
	}
	value, ok := issue.Evidence[key]
	if !ok {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case fmt.Stringer:
		return strings.TrimSpace(typed.String())
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", value))
	}
}

func buildRelatedInfo(issue audit.Issue, uri string, path string, repoRoot string, rng protocol.Range, includeEvidence bool, redactMode audit.RedactMode) []protocol.DiagnosticRelatedInformation {
	if redactMode != audit.RedactNever {
		return nil
	}
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

func buildDiagnosticData(issue audit.Issue, includeEvidence bool, redactMode audit.RedactMode) map[string]any {
	paths := filterDiagnosticPaths(issue.Paths, redactMode)
	data := map[string]any{
		"ruleId":     issue.RuleID,
		"title":      issue.Title,
		"suggestion": issue.Suggestion,
		"paths":      paths,
		"tools":      issue.Tools,
	}
	if issue.Severity != "" {
		data["severity"] = issue.Severity
	}
	if issue.Fingerprint != "" {
		data["fingerprint"] = issue.Fingerprint
	}
	if meta := issueRuleData(issue); meta != nil && len(meta.QuickFixes) > 0 {
		data["quickFixes"] = append([]string(nil), meta.QuickFixes...)
	}
	if meta := issueRuleData(issue); meta != nil {
		if meta.Category != "" {
			data["category"] = meta.Category
		}
		if meta.DocURL != "" {
			data["docUrl"] = meta.DocURL
		}
	}
	if includeEvidence {
		data["evidence"] = sanitizeEvidence(issue.Evidence, redactMode)
	}
	return data
}

func filterDiagnosticPaths(paths []audit.Path, redactMode audit.RedactMode) []audit.Path {
	if redactMode == audit.RedactNever || len(paths) == 0 {
		return paths
	}
	filtered := make([]audit.Path, 0, len(paths))
	for _, path := range paths {
		if path.Redacted {
			filtered = append(filtered, path)
			continue
		}
		if isAbsolutePath(path.Path) {
			continue
		}
		filtered = append(filtered, path)
	}
	return filtered
}

func sanitizeEvidence(evidence map[string]any, redactMode audit.RedactMode) map[string]any {
	if redactMode == audit.RedactNever || len(evidence) == 0 {
		return evidence
	}
	sanitized := make(map[string]any, len(evidence))
	for key, value := range evidence {
		if cleaned, ok := sanitizeEvidenceValue(value); ok {
			sanitized[key] = cleaned
		}
	}
	return sanitized
}

func sanitizeEvidenceValue(value any) (any, bool) {
	switch typed := value.(type) {
	case string:
		if isAbsolutePath(typed) {
			return nil, false
		}
		return typed, true
	case []string:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if isAbsolutePath(item) {
				continue
			}
			out = append(out, item)
		}
		if len(out) == 0 {
			return nil, false
		}
		return out, true
	case []any:
		out := make([]any, 0, len(typed))
		for _, item := range typed {
			switch v := item.(type) {
			case string:
				if isAbsolutePath(v) {
					continue
				}
				out = append(out, v)
			default:
				out = append(out, item)
			}
		}
		if len(out) == 0 {
			return nil, false
		}
		return out, true
	default:
		return value, true
	}
}

func issueRuleData(issue audit.Issue) *audit.RuleData {
	switch typed := issue.Data.(type) {
	case audit.RuleData:
		return &typed
	case *audit.RuleData:
		return typed
	default:
		if meta, ok := lspRuleMetadata[issue.RuleID]; ok {
			return &meta
		}
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

func diagnosticCodeDescription(docURL string) *protocol.CodeDescription {
	href := sanitizeDocURL(docURL)
	if href == "" {
		return nil
	}
	return &protocol.CodeDescription{HRef: href}
}

func sanitizeDocURL(docURL string) string {
	raw := strings.TrimSpace(docURL)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if parsed.Scheme != "" {
		if strings.ToLower(parsed.Scheme) != "https" {
			return ""
		}
		if parsed.Host == "" {
			return ""
		}
		return parsed.String()
	}

	cleaned := path.Clean("/" + filepath.ToSlash(parsed.Path))
	cleaned = strings.TrimPrefix(cleaned, "/")
	if cleaned == "." || strings.HasPrefix(cleaned, "..") {
		return ""
	}
	href := docsBaseURL + cleaned
	if parsed.RawQuery != "" {
		href += "?" + parsed.RawQuery
	}
	if parsed.Fragment != "" {
		href += "#" + parsed.Fragment
	}
	return href
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

func isAbsolutePath(value string) bool {
	if value == "" {
		return false
	}
	if filepath.IsAbs(value) {
		return true
	}
	if strings.HasPrefix(value, "/") || strings.HasPrefix(value, "\\") {
		return true
	}
	if len(value) >= 2 && value[1] == ':' {
		return true
	}
	return false
}
