package lsp

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"markdowntown-cli/internal/audit"

	"github.com/spf13/afero"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

const (
	quickFixAllowGitignore      = "allow-gitignore"
	quickFixRemoveFrontmatter   = "remove-frontmatter"
	quickFixInsertPlaceholder   = "insert-placeholder"
	quickFixCreateRepoConfig    = "create-repo-config"
	quickFixRemoveDuplicateFM   = "remove-duplicate-frontmatter"
	quickFixInsertFrontmatterID = "insert-frontmatter-id"
	quickFixReplaceToolID       = "replace-toolid"
)

type codeActionRequest struct {
	uri      string
	path     string
	content  string
	settings Settings
}

type codeActionEntry struct {
	action    protocol.CodeAction
	ruleID    string
	fixID     string
	preferred bool
	title     string
}

func (s *Server) codeActionsForDiagnostic(diag protocol.Diagnostic, req codeActionRequest) []codeActionEntry {
	ruleID := diagnosticRuleID(diag)
	fixIDs := diagnosticQuickFixes(diag)
	if len(fixIDs) == 0 {
		fixIDs = defaultQuickFixesForRule(ruleID)
	}
	if len(fixIDs) == 0 {
		return nil
	}

	redactEnabled := req.settings.Diagnostics.RedactPaths != audit.RedactNever
	entries := make([]codeActionEntry, 0, len(fixIDs))
	for _, fixID := range fixIDs {
		if redactEnabled && (fixID == quickFixAllowGitignore || fixID == quickFixCreateRepoConfig) {
			continue
		}
		action := s.codeActionForFix(fixID, diag, req)
		if action == nil {
			continue
		}
		entries = append(entries, codeActionEntry{
			action: *action,
			ruleID: ruleID,
			fixID:  fixID,
			title:  action.Title,
		})
	}
	if len(entries) == 0 {
		return nil
	}
	preferred := true
	entries[0].preferred = true
	entries[0].action.IsPreferred = &preferred
	return entries
}

func sortCodeActionEntries(entries []codeActionEntry) {
	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].preferred != entries[j].preferred {
			return entries[i].preferred
		}
		if entries[i].title != entries[j].title {
			return entries[i].title < entries[j].title
		}
		if entries[i].ruleID != entries[j].ruleID {
			return entries[i].ruleID < entries[j].ruleID
		}
		return entries[i].fixID < entries[j].fixID
	})
}

func (s *Server) codeActionForFix(fixID string, diag protocol.Diagnostic, req codeActionRequest) *protocol.CodeAction {
	switch fixID {
	case quickFixRemoveFrontmatter:
		return codeActionRemoveFrontmatter(diag, req.uri, req.content)
	case quickFixInsertPlaceholder:
		return codeActionInsertPlaceholder(diag, req.uri, req.path, req.content)
	case quickFixAllowGitignore:
		return s.codeActionAllowGitignore(diag, req.path)
	case quickFixCreateRepoConfig:
		return s.codeActionCreateRepoConfig(diag, req.path)
	case quickFixRemoveDuplicateFM:
		return codeActionRemoveDuplicateFrontmatter(diag, req.uri, req.content)
	case quickFixInsertFrontmatterID:
		return codeActionInsertFrontmatter(diag, req.uri, req.path, req.content)
	case quickFixReplaceToolID:
		return codeActionReplaceToolID(diag, req.uri, req.content)
	default:
		return nil
	}
}

func diagnosticQuickFixes(diag protocol.Diagnostic) []string {
	if diag.Data == nil {
		return nil
	}
	data, ok := diag.Data.(map[string]any)
	if !ok {
		return nil
	}
	raw, ok := data["quickFixes"]
	if !ok {
		return nil
	}
	return dedupeStrings(parseStringSlice(raw))
}

func defaultQuickFixesForRule(ruleID string) []string {
	switch ruleID {
	case "MD002":
		return []string{quickFixAllowGitignore}
	case "MD003":
		return []string{quickFixRemoveFrontmatter}
	case "MD004":
		return []string{quickFixInsertPlaceholder}
	case "MD005":
		return []string{quickFixCreateRepoConfig}
	case "MD007":
		return []string{quickFixRemoveDuplicateFM}
	case "MD012":
		return []string{quickFixInsertFrontmatterID}
	case "MD015":
		return []string{quickFixReplaceToolID}
	default:
		return nil
	}
}

func dedupeStrings(values []string) []string {
	seen := make(map[string]struct{})
	deduped := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		deduped = append(deduped, value)
	}
	return deduped
}

func codeActionRemoveFrontmatter(diag protocol.Diagnostic, uri string, content string) *protocol.CodeAction {
	fmRange := frontmatterBlockRange(content)
	if fmRange == nil {
		return nil
	}
	kind := protocol.CodeActionKindQuickFix
	action := protocol.CodeAction{
		Title:       actionTitleRemoveFrontmatter,
		Kind:        &kind,
		Diagnostics: []protocol.Diagnostic{diag},
		Edit: &protocol.WorkspaceEdit{
			Changes: map[string][]protocol.TextEdit{
				uri: {
					{
						Range:   *fmRange,
						NewText: "",
					},
				},
			},
		},
	}
	return &action
}

func codeActionInsertPlaceholder(diag protocol.Diagnostic, uri string, path string, content string) *protocol.CodeAction {
	if strings.TrimSpace(content) != "" {
		return nil
	}
	stub := stubContentForPath(path)
	if stub == "" {
		return nil
	}
	kind := protocol.CodeActionKindQuickFix
	action := protocol.CodeAction{
		Title:       actionTitleInsertPlaceholder,
		Kind:        &kind,
		Diagnostics: []protocol.Diagnostic{diag},
		Edit: &protocol.WorkspaceEdit{
			Changes: map[string][]protocol.TextEdit{
				uri: {
					{
						Range:   protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
						NewText: stub,
					},
				},
			},
		},
	}
	return &action
}

func (s *Server) codeActionAllowGitignore(diag protocol.Diagnostic, path string) *protocol.CodeAction {
	repoRoot := repoRootForPath(s.rootPath, path)
	if repoRoot == "" {
		return nil
	}
	rel, ok := relativeRepoPath(repoRoot, path)
	if !ok {
		return nil
	}
	entry := "!" + rel
	gitignorePath := filepath.Join(repoRoot, ".gitignore")
	return quickFixGitignore(s.fs, entry, gitignorePath, diag)
}

func (s *Server) codeActionCreateRepoConfig(diag protocol.Diagnostic, path string) *protocol.CodeAction {
	candidate := candidateRepoPathFromDiagnostic(diag)
	if candidate == "" {
		return nil
	}
	repoRoot := repoRootForPath(s.rootPath, path)
	if repoRoot == "" {
		return nil
	}
	if isGlobPath(candidate) {
		return nil
	}
	absPath := filepath.Join(repoRoot, filepath.FromSlash(candidate))
	if _, err := s.fs.Stat(absPath); err == nil {
		return nil
	}
	parent := filepath.Dir(absPath)
	if info, err := s.fs.Stat(parent); err != nil || !info.IsDir() {
		return nil
	}
	stub := stubContentForPath(absPath)
	if stub == "" {
		return nil
	}
	uri := pathToURI(absPath)
	kind := protocol.CodeActionKindQuickFix
	action := protocol.CodeAction{
		Title:       actionTitleCreateRepoPrefix + candidate,
		Kind:        &kind,
		Diagnostics: []protocol.Diagnostic{diag},
		Edit: &protocol.WorkspaceEdit{
			DocumentChanges: []any{
				protocol.CreateFile{
					Kind:    "create",
					URI:     uri,
					Options: &protocol.CreateFileOptions{IgnoreIfExists: boolPtr(true)},
				},
				protocol.TextDocumentEdit{
					TextDocument: protocol.OptionalVersionedTextDocumentIdentifier{
						TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
					},
					Edits: []any{
						protocol.TextEdit{
							Range:   protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
							NewText: stub,
						},
					},
				},
			},
		},
	}
	return &action
}

func codeActionRemoveDuplicateFrontmatter(diag protocol.Diagnostic, uri string, content string) *protocol.CodeAction {
	lineIndex := int(diag.Range.Start.Line)
	lineText, ok := lineTextAt(content, lineIndex)
	if !ok {
		return nil
	}
	if fmRange := frontmatterBlockRange(content); fmRange == nil || lineIndex > int(fmRange.End.Line) {
		return nil
	}
	field := diagnosticEvidenceString(diag, "field")
	value := diagnosticEvidenceString(diag, "value")
	lowerLine := strings.ToLower(strings.TrimSpace(lineText))
	if field != "" && !strings.Contains(lowerLine, strings.ToLower(field)+":") {
		return nil
	}
	deleteRange := lineDeleteRange(content, lineIndex)
	if deleteRange == nil {
		return nil
	}
	title := actionTitleRemoveDuplicateFrontmatterPrefix + "entry"
	if field != "" && value != "" {
		title = fmt.Sprintf("%s%s=%s", actionTitleRemoveDuplicateFrontmatterPrefix, field, value)
	} else if field != "" {
		title = actionTitleRemoveDuplicateFrontmatterPrefix + field
	}
	kind := protocol.CodeActionKindQuickFix
	action := protocol.CodeAction{
		Title:       title,
		Kind:        &kind,
		Diagnostics: []protocol.Diagnostic{diag},
		Edit: &protocol.WorkspaceEdit{
			Changes: map[string][]protocol.TextEdit{
				uri: {
					{
						Range:   *deleteRange,
						NewText: "",
					},
				},
			},
		},
	}
	return &action
}

func codeActionInsertFrontmatter(diag protocol.Diagnostic, uri string, path string, content string) *protocol.CodeAction {
	required := diagnosticEvidenceStrings(diag, "requiredKeys")
	if len(required) == 0 {
		return nil
	}
	key := required[0]
	value := identifierFromPath(path)
	if strings.TrimSpace(value) == "" {
		value = "change-me"
	}

	insertRange := protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}}
	insertText := fmt.Sprintf("---\n%s: %s\n---\n\n", key, value)
	if closingLine, ok := frontmatterClosingLine(content); ok {
		insertRange = protocol.Range{
			Start: protocol.Position{Line: clampToUint32(closingLine), Character: 0},
			End:   protocol.Position{Line: clampToUint32(closingLine), Character: 0},
		}
		insertText = fmt.Sprintf("%s: %s\n", key, value)
	} else if frontmatterHasOpeningLine(content) {
		return nil
	}

	kind := protocol.CodeActionKindQuickFix
	action := protocol.CodeAction{
		Title:       actionTitleInsertFrontmatterPrefix + key,
		Kind:        &kind,
		Diagnostics: []protocol.Diagnostic{diag},
		Edit: &protocol.WorkspaceEdit{
			Changes: map[string][]protocol.TextEdit{
				uri: {
					{
						Range:   insertRange,
						NewText: insertText,
					},
				},
			},
		},
	}
	return &action
}

func codeActionReplaceToolID(diag protocol.Diagnostic, uri string, content string) *protocol.CodeAction {
	replacement := diagnosticDataString(diag, "replacement")
	if replacement == "" {
		return nil
	}
	current := textAtRange(content, diag.Range)
	if current == "" {
		return nil
	}
	if strings.TrimSpace(current) == strings.TrimSpace(replacement) {
		return nil
	}
	original := diagnosticDataString(diag, "toolId")
	if original != "" && strings.TrimSpace(current) != original {
		return nil
	}
	kind := protocol.CodeActionKindQuickFix
	action := protocol.CodeAction{
		Title:       actionTitleReplaceToolIDPrefix + replacement,
		Kind:        &kind,
		Diagnostics: []protocol.Diagnostic{diag},
		Edit: &protocol.WorkspaceEdit{
			Changes: map[string][]protocol.TextEdit{
				uri: {
					{
						Range:   diag.Range,
						NewText: replacement,
					},
				},
			},
		},
	}
	return &action
}

func diagnosticRuleID(diag protocol.Diagnostic) string {
	if diag.Code != nil {
		if value, ok := diag.Code.Value.(string); ok && value != "" {
			return value
		}
	}
	if diag.Data != nil {
		if data, ok := diag.Data.(map[string]any); ok {
			if value, ok := data["ruleId"].(string); ok {
				return value
			}
		}
	}
	return ""
}

func candidateRepoPathFromDiagnostic(diag protocol.Diagnostic) string {
	if diag.Data == nil {
		return ""
	}
	data, ok := diag.Data.(map[string]any)
	if !ok {
		return ""
	}
	evidence, ok := data["evidence"].(map[string]any)
	if !ok {
		return ""
	}
	raw, ok := evidence["candidatePaths"]
	if !ok {
		return ""
	}
	switch typed := raw.(type) {
	case []string:
		if len(typed) > 0 {
			return typed[0]
		}
	case []any:
		for _, item := range typed {
			if s, ok := item.(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}

func diagnosticEvidenceValue(diag protocol.Diagnostic, key string) (any, bool) {
	if diag.Data == nil {
		return nil, false
	}
	data, ok := diag.Data.(map[string]any)
	if !ok {
		return nil, false
	}
	evidence, ok := data["evidence"].(map[string]any)
	if !ok {
		return nil, false
	}
	value, ok := evidence[key]
	return value, ok
}

func diagnosticEvidenceString(diag protocol.Diagnostic, key string) string {
	value, ok := diagnosticEvidenceValue(diag, key)
	if !ok {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case []string:
		if len(typed) > 0 {
			return typed[0]
		}
	case []any:
		for _, item := range typed {
			if str, ok := item.(string); ok && str != "" {
				return str
			}
		}
	}
	return fmt.Sprintf("%v", value)
}

func quickFixGitignore(fs afero.Fs, entry string, gitignorePath string, diag protocol.Diagnostic) *protocol.CodeAction {
	if entry == "!" {
		return nil
	}
	uri := pathToURI(gitignorePath)
	kind := protocol.CodeActionKindQuickFix

	content := ""
	if data, err := afero.ReadFile(fs, gitignorePath); err == nil {
		content = string(data)
	}

	if hasGitignoreEntry(content, entry) {
		return nil
	}

	insert := entry + "\n"
	if content != "" && !strings.HasSuffix(content, "\n") {
		insert = "\n" + entry + "\n"
	}

	edit := &protocol.WorkspaceEdit{}
	if _, err := fs.Stat(gitignorePath); err == nil {
		pos := endPositionForContent(content)
		edit.Changes = map[string][]protocol.TextEdit{
			uri: {
				{
					Range:   protocol.Range{Start: pos, End: pos},
					NewText: insert,
				},
			},
		}
	} else {
		edit.DocumentChanges = []any{
			protocol.CreateFile{
				Kind:    "create",
				URI:     uri,
				Options: &protocol.CreateFileOptions{IgnoreIfExists: boolPtr(true)},
			},
			protocol.TextDocumentEdit{
				TextDocument: protocol.OptionalVersionedTextDocumentIdentifier{
					TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
				},
				Edits: []any{
					protocol.TextEdit{
						Range:   protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
						NewText: insert,
					},
				},
			},
		}
	}

	action := protocol.CodeAction{
		Title:       actionTitleAllowGitignoreEntry,
		Kind:        &kind,
		Diagnostics: []protocol.Diagnostic{diag},
		Edit:        edit,
	}
	return &action
}

func textAtRange(content string, rng protocol.Range) string {
	if rng.Start.Line != rng.End.Line {
		return ""
	}
	lineText, ok := lineTextAt(content, int(rng.Start.Line))
	if !ok {
		return ""
	}
	runes := []rune(lineText)
	start := int(rng.Start.Character)
	end := int(rng.End.Character)
	if start < 0 || end < 0 || start > end || end > len(runes) {
		return ""
	}
	return string(runes[start:end])
}
