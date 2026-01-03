// Package lsp implements the markdowntown language server protocol handlers.
package lsp

import (
	"fmt"
	"net/url"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
	"unicode/utf16"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"

	"github.com/spf13/afero"
	"github.com/tliron/commonlog"
	_ "github.com/tliron/commonlog/simple" // enable default logger
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
	"github.com/tliron/glsp/server"
)

const (
	serverName      = "markdowntown"
	debounceTimeout = 500 * time.Millisecond

	actionTitleRemoveFrontmatter   = "Remove invalid frontmatter block"
	actionTitleInsertPlaceholder   = "Insert placeholder instructions"
	actionTitleAllowGitignoreEntry = "Allow this config in .gitignore"
	actionTitleCreateRepoPrefix    = "Create repo config at "
)

// Server holds LSP state and handlers.
type Server struct {
	version string
	handler *protocol.Handler
	server  *server.Server
	overlay afero.Fs
	base    afero.Fs
	fs      afero.Fs

	// Workspace state
	rootPath string

	// Diagnostics state
	diagnosticsMu    sync.Mutex
	diagnosticTimers map[string]*time.Timer
	Debounce         time.Duration

	// Cache state
	cacheMu          sync.Mutex
	frontmatterCache map[string]*scan.ParsedFrontmatter
}

// NewServer constructs a new LSP server.
func NewServer(version string) *Server {
	s := &Server{
		version:          version,
		overlay:          afero.NewMemMapFs(),
		base:             afero.NewOsFs(),
		diagnosticTimers: make(map[string]*time.Timer),
		Debounce:         debounceTimeout,
		frontmatterCache: make(map[string]*scan.ParsedFrontmatter),
	}
	s.fs = afero.NewCopyOnWriteFs(s.base, s.overlay)

	s.handler = &protocol.Handler{
		Initialize:             s.initialize,
		Initialized:            s.initialized,
		Shutdown:               s.shutdown,
		SetTrace:               s.setTrace,
		TextDocumentDidOpen:    s.didOpen,
		TextDocumentDidChange:  s.didChange,
		TextDocumentDidClose:   s.didClose,
		TextDocumentHover:      s.hover,
		TextDocumentDefinition: s.definition,
		TextDocumentCompletion: s.completion,
	}

	s.server = server.NewServer(s.handler, serverName, false)
	return s
}

// Run starts the LSP server stdio loop.
func (s *Server) Run() error {
	return s.server.RunStdio()
}

func (s *Server) initialize(_ *glsp.Context, params *protocol.InitializeParams) (any, error) {
	if params.RootURI != nil {
		path, err := urlToPath(*params.RootURI)
		if err == nil {
			s.rootPath = path
		}
	} else if params.RootPath != nil {
		s.rootPath = *params.RootPath
	}

	capabilities := protocol.ServerCapabilities{
		TextDocumentSync:   protocol.TextDocumentSyncKindFull,
		HoverProvider:      true,
		DefinitionProvider: true,
		CompletionProvider: &protocol.CompletionOptions{
			TriggerCharacters: []string{":", " "},
		},
	}

	return protocol.InitializeResult{
		Capabilities: capabilities,
		ServerInfo: &protocol.InitializeResultServerInfo{
			Name:    serverName,
			Version: &s.version,
		},
	}, nil
}

func (s *Server) initialized(_ *glsp.Context, _ *protocol.InitializedParams) error {
	return nil
}

func (s *Server) shutdown(_ *glsp.Context) error {
	protocol.SetTraceValue(protocol.TraceValueOff)
	return nil
}

func (s *Server) setTrace(_ *glsp.Context, params *protocol.SetTraceParams) error {
	protocol.SetTraceValue(params.Value)
	return nil
}

func (s *Server) didOpen(context *glsp.Context, params *protocol.DidOpenTextDocumentParams) error {
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return err
	}
	err = afero.WriteFile(s.overlay, path, []byte(params.TextDocument.Text), 0644)
	if err != nil {
		return err
	}

	// Cache frontmatter
	parsed, _, _ := scan.ParseFrontmatter([]byte(params.TextDocument.Text))
	s.cacheMu.Lock()
	s.frontmatterCache[params.TextDocument.URI] = parsed
	s.cacheMu.Unlock()

	s.triggerDiagnostics(context, params.TextDocument.URI)
	return nil
}

func (s *Server) didChange(context *glsp.Context, params *protocol.DidChangeTextDocumentParams) error {
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return err
	}

	// Handle full content sync first as per task notes
	var lastContent string
	for _, change := range params.ContentChanges {
		if c, ok := change.(protocol.TextDocumentContentChangeEvent); ok {
			lastContent = c.Text
			err = afero.WriteFile(s.overlay, path, []byte(c.Text), 0644)
			if err != nil {
				return err
			}
		}
	}

	if lastContent != "" {
		parsed, _, _ := scan.ParseFrontmatter([]byte(lastContent))
		s.cacheMu.Lock()
		s.frontmatterCache[params.TextDocument.URI] = parsed
		s.cacheMu.Unlock()
	}

	s.triggerDiagnostics(context, params.TextDocument.URI)
	return nil
}

func (s *Server) didClose(_ *glsp.Context, params *protocol.DidCloseTextDocumentParams) error {
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return err
	}

	s.cacheMu.Lock()
	delete(s.frontmatterCache, params.TextDocument.URI)
	s.cacheMu.Unlock()

	return s.overlay.Remove(path)
}

func (s *Server) hover(_ *glsp.Context, params *protocol.HoverParams) (*protocol.Hover, error) {
	s.cacheMu.Lock()
	parsed := s.frontmatterCache[params.TextDocument.URI]
	s.cacheMu.Unlock()

	if parsed == nil {
		return nil, nil //nolint:nilnil
	}

	line := int(params.Position.Line + 1)

	var foundKey string
	for key, loc := range parsed.Locations {
		if loc.StartLine == line {
			foundKey = key
			break
		}
	}

	if foundKey == "" {
		return nil, nil //nolint:nilnil // Valid LSP response for no hover
	}

	if strings.Contains(foundKey, "toolId") {
		val, ok := getValue(parsed.Data, foundKey)
		if ok {
			toolID, _ := val.(string)
			if toolID != "" {
				registry, _, err := scan.LoadRegistry()
				if err == nil {
					for _, p := range registry.Patterns {
						if p.ToolID == toolID {
							content := fmt.Sprintf("**%s**\n\n%s\n\nDocs: %s", p.ToolName, p.Notes, strings.Join(p.Docs, ", "))
							return &protocol.Hover{
								Contents: protocol.MarkupContent{
									Kind:  protocol.MarkupKindMarkdown,
									Value: content,
								},
							}, nil
						}
					}
				}
			}
		}
	}

	return nil, nil //nolint:nilnil
}

func (s *Server) definition(_ *glsp.Context, params *protocol.DefinitionParams) (any, error) {
	s.cacheMu.Lock()
	parsed := s.frontmatterCache[params.TextDocument.URI]
	s.cacheMu.Unlock()

	if parsed == nil {
		return nil, nil //nolint:nilnil
	}

	line := int(params.Position.Line + 1)
	var foundKey string
	for key, loc := range parsed.Locations {
		if loc.StartLine == line {
			foundKey = key
			break
		}
	}

	if foundKey == "" {
		return nil, nil //nolint:nilnil // Valid LSP response for no definition
	}

	if strings.Contains(foundKey, "toolId") {
		val, ok := getValue(parsed.Data, foundKey)
		if ok {
			toolID, _ := val.(string)
			if toolID != "" {
				repoRoot := s.rootPath
				if repoRoot != "" {
					agentsPath := filepath.Join(repoRoot, "AGENTS.md")
					if _, err := s.fs.Stat(agentsPath); err == nil {
						return protocol.Location{
							URI: pathToURL(agentsPath),
							Range: protocol.Range{
								Start: protocol.Position{Line: 0, Character: 0},
								End:   protocol.Position{Line: 0, Character: 0},
							},
						}, nil
					}
				}
			}
		}
	}

	return nil, nil //nolint:nilnil
}

func (s *Server) triggerDiagnostics(context *glsp.Context, uri string) {
	if context == nil {
		return
	}
	s.diagnosticsMu.Lock()
	defer s.diagnosticsMu.Unlock()

	if timer, ok := s.diagnosticTimers[uri]; ok {
		timer.Stop()
	}

	delay := s.Debounce
	if delay <= 0 {
		delay = debounceTimeout
	}
	s.diagnosticTimers[uri] = time.AfterFunc(delay, func() {
		s.runDiagnostics(context, uri)
	})
}

func (s *Server) runDiagnostics(context *glsp.Context, uri string) {
	path, err := urlToPath(uri)
	if err != nil {
		return
	}

	repoRoot := s.rootPath
	if repoRoot == "" {
		repoRoot = filepath.Dir(path)
	}

	registry, _, err := scan.LoadRegistry()
	if err != nil {
		return
	}

	var stdinPaths []string
	if _, err := s.overlay.Stat(path); err == nil {
		if _, err := s.base.Stat(path); err != nil {
			stdinPaths = append(stdinPaths, path)
		}
	}

	result, err := scan.Scan(scan.Options{
		RepoRoot:       repoRoot,
		IncludeContent: true,
		StdinPaths:     stdinPaths,
		Registry:       registry,
		Fs:             s.fs,
	})
	if err != nil {
		return
	}
	if updated, err := scan.ApplyGitignore(result, repoRoot); err == nil {
		result = updated
	}

	redactor := audit.NewRedactor(repoRoot, "", "", audit.RedactNever)
	auditCtx := audit.Context{
		Scan: scan.BuildOutput(result, scan.OutputOptions{
			RepoRoot: repoRoot,
		}),
		Registry: registry,
		Redactor: redactor,
	}

	rules := audit.DefaultRules()
	issues := audit.RunRules(auditCtx, rules)

	diagnostics := make([]protocol.Diagnostic, 0)
	for _, issue := range issues {
		match := false
		for _, p := range issue.Paths {
			if p.Path == path || filepath.Join(repoRoot, p.Path) == path {
				match = true
				break
			}
		}

		if match {
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
				Data: map[string]any{
					"ruleId":     issue.RuleID,
					"title":      issue.Title,
					"suggestion": issue.Suggestion,
					"evidence":   issue.Evidence,
				},
			}
			if issue.Suggestion != "" {
				diag.RelatedInformation = []protocol.DiagnosticRelatedInformation{
					{
						Location: protocol.Location{
							URI:   uri,
							Range: diag.Range,
						},
						Message: "Suggestion: " + issue.Suggestion,
					},
				}
			}
			diagnostics = append(diagnostics, diag)
		}
	}

	context.Notify(protocol.ServerTextDocumentPublishDiagnostics, protocol.PublishDiagnosticsParams{
		URI:         uri,
		Diagnostics: diagnostics,
	})
}

func getValue(data map[string]any, keyPath string) (any, bool) {
	parts := strings.Split(keyPath, ".")
	var current any = data
	for _, part := range parts {
		m, ok := current.(map[string]any)
		if !ok {
			return nil, false
		}
		current, ok = m[part]
		if !ok {
			return nil, false
		}
	}
	return current, true
}

func issueToProtocolRange(r *scan.Range) protocol.Range {
	if r == nil || r.StartLine <= 0 {
		return protocol.Range{
			Start: protocol.Position{Line: 0, Character: 0},
			End:   protocol.Position{Line: 0, Character: 0},
		}
	}
	return protocol.Range{
		Start: protocol.Position{Line: clampToUint32(r.StartLine - 1), Character: clampToUint32(r.StartCol - 1)},
		End:   protocol.Position{Line: clampToUint32(r.EndLine - 1), Character: clampToUint32(r.EndCol - 1)},
	}
}

func severityToProtocolSeverity(s audit.Severity) *protocol.DiagnosticSeverity {
	var sev protocol.DiagnosticSeverity
	switch s {
	case audit.SeverityError:
		sev = protocol.DiagnosticSeverityError
	case audit.SeverityWarning:
		sev = protocol.DiagnosticSeverityWarning
	case audit.SeverityInfo:
		sev = protocol.DiagnosticSeverityInformation
	default:
		sev = protocol.DiagnosticSeverityHint
	}
	return &sev
}

// urlToPath converts a file URI to a filesystem path.
// It supports file:// scheme with localhost or empty host.
// It handles percent-encoded characters and platform-specific path formats.
// Non-file URIs are returned as-is for fallback handling.
func urlToPath(uri string) (string, error) {
	if !strings.HasPrefix(uri, "file://") {
		return uri, nil
	}
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}

	if parsed.Scheme != "file" {
		return uri, nil
	}

	path := parsed.EscapedPath()
	if path == "" {
		path = parsed.Path
	}

	if parsed.Host != "" && parsed.Host != "localhost" {
		// UNC path or non-localhost authority
		path = "//" + parsed.Host + path
	}

	path, err = url.PathUnescape(path)
	if err != nil {
		return "", fmt.Errorf("invalid percent encoding: %w", err)
	}

	if runtime.GOOS == "windows" && len(path) >= 3 && path[0] == '/' && path[2] == ':' {
		path = path[1:]
	}

	return filepath.Clean(filepath.FromSlash(path)), nil
}

// pathToURL converts a filesystem path to a file URI.
func pathToURL(path string) string {
	path = filepath.Clean(path)
	if runtime.GOOS == "windows" {
		if len(path) >= 2 && path[1] == ':' {
			// Local drive path: file:///C:/path/to/file
			return "file:///" + filepath.ToSlash(path)
		}
		if strings.HasPrefix(path, `\\`) {
			// UNC path: file://server/share/path
			return "file:" + filepath.ToSlash(path)
		}
	}
	// Unix path: file:///path/to/file
	return "file://" + filepath.ToSlash(path)
}

func clampToUint32(value int) uint32 {
	if value <= 0 {
		return 0
	}
	const maxUint32 = int(^uint32(0))
	if value > maxUint32 {
		// #nosec G115 -- value is clamped to uint32 range.
		return uint32(maxUint32)
	}
	// #nosec G115 -- value is clamped to uint32 range.
	return uint32(value)
}

func (s *Server) codeAction(_ *glsp.Context, params *protocol.CodeActionParams) (any, error) {
	if params == nil {
		return nil, nil
	}
	if len(params.Context.Diagnostics) == 0 {
		return nil, nil
	}

	if len(params.Context.Only) > 0 {
		allowed := false
		for _, kind := range params.Context.Only {
			if kind == protocol.CodeActionKindQuickFix || kind == protocol.CodeActionKindEmpty {
				allowed = true
				break
			}
		}
		if !allowed {
			return nil, nil
		}
	}

	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return nil, err
	}
	data, err := afero.ReadFile(s.fs, path)
	if err != nil {
		return nil, nil
	}
	content := string(data)

	var actions []protocol.CodeAction
	for _, diag := range params.Context.Diagnostics {
		ruleID := diagnosticRuleID(diag)
		switch ruleID {
		case "MD003":
			if fmRange := frontmatterBlockRange(content); fmRange != nil {
				kind := protocol.CodeActionKindQuickFix
				preferred := true
				action := protocol.CodeAction{
					Title:       actionTitleRemoveFrontmatter,
					Kind:        &kind,
					Diagnostics: []protocol.Diagnostic{diag},
					IsPreferred: &preferred,
					Edit: &protocol.WorkspaceEdit{
						Changes: map[string][]protocol.TextEdit{
							params.TextDocument.URI: {
								{
									Range:   *fmRange,
									NewText: "",
								},
							},
						},
					},
				}
				actions = append(actions, action)
			}
		case "MD004":
			if strings.TrimSpace(content) == "" {
				if stub := stubContentForPath(path); stub != "" {
					kind := protocol.CodeActionKindQuickFix
					preferred := true
					action := protocol.CodeAction{
						Title:       actionTitleInsertPlaceholder,
						Kind:        &kind,
						Diagnostics: []protocol.Diagnostic{diag},
						IsPreferred: &preferred,
						Edit: &protocol.WorkspaceEdit{
							Changes: map[string][]protocol.TextEdit{
								params.TextDocument.URI: {
									{
										Range:   protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
										NewText: stub,
									},
								},
							},
						},
					}
					actions = append(actions, action)
				}
			}
		case "MD002":
			if repoRoot := repoRootForPath(s.rootPath, path); repoRoot != "" {
				if rel, ok := relativeRepoPath(repoRoot, path); ok {
					entry := "!" + rel
					gitignorePath := filepath.Join(repoRoot, ".gitignore")
					action := quickFixGitignore(s.fs, entry, gitignorePath, diag)
					if action != nil {
						actions = append(actions, *action)
					}
				}
			}
		case "MD005":
			candidate := candidateRepoPathFromDiagnostic(diag)
			if candidate == "" {
				continue
			}
			repoRoot := repoRootForPath(s.rootPath, path)
			if repoRoot == "" {
				continue
			}
			if isGlobPath(candidate) {
				continue
			}
			absPath := filepath.Join(repoRoot, filepath.FromSlash(candidate))
			if _, err := s.fs.Stat(absPath); err == nil {
				continue
			}
			parent := filepath.Dir(absPath)
			if info, err := s.fs.Stat(parent); err != nil || !info.IsDir() {
				continue
			}
			stub := stubContentForPath(absPath)
			if stub == "" {
				continue
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
			actions = append(actions, action)
		}
	}

	if len(actions) == 0 {
		return nil, nil
	}
	return actions, nil
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

func quickFixGitignore(fs afero.Fs, entry string, gitignorePath string, diag protocol.Diagnostic) *protocol.CodeAction {
	if entry == "!" {
		return nil
	}
	uri := pathToURI(gitignorePath)
	kind := protocol.CodeActionKindQuickFix
	preferred := true

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
		IsPreferred: &preferred,
		Edit:        edit,
	}
	return &action
}

func hasGitignoreEntry(content string, entry string) bool {
	if entry == "" {
		return true
	}
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == entry {
			return true
		}
		if strings.TrimSpace(line) == "!/"+strings.TrimPrefix(entry, "!") {
			return true
		}
	}
	return false
}

func repoRootForPath(root string, path string) string {
	if root != "" {
		return filepath.Clean(root)
	}
	return filepath.Dir(path)
}

func relativeRepoPath(repoRoot string, path string) (string, bool) {
	if repoRoot == "" || path == "" {
		return "", false
	}
	rel, err := filepath.Rel(repoRoot, path)
	if err != nil {
		return "", false
	}
	if strings.HasPrefix(rel, "..") {
		return "", false
	}
	rel = filepath.ToSlash(rel)
	rel = strings.TrimPrefix(rel, "./")
	return rel, rel != ""
}

func isGlobPath(path string) bool {
	return strings.ContainsAny(path, "*?[")
}

func stubContentForPath(path string) string {
	lower := strings.ToLower(path)
	switch strings.ToLower(filepath.Ext(lower)) {
	case ".md", ".markdown", ".mdx":
		return "# Instructions\n"
	case ".json":
		return "{\n}\n"
	case ".yml", ".yaml", ".toml":
		return "# TODO: add instructions\n"
	case ".txt":
		return "TODO: add instructions\n"
	default:
		if strings.HasSuffix(lower, ".prompt.md") || strings.HasSuffix(lower, ".instructions.md") {
			return "# Instructions\n"
		}
		return ""
	}
}

func endPositionForContent(content string) protocol.Position {
	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		return protocol.Position{Line: 0, Character: 0}
	}
	line := len(lines) - 1
	return protocol.Position{Line: clampToUint32(line), Character: utf16Len(lines[line])}
}

func boolPtr(value bool) *bool {
	return &value
}

func pathToURI(path string) string {
	if path == "" {
		return ""
	}
	abs := path
	if !filepath.IsAbs(abs) {
		if resolved, err := filepath.Abs(abs); err == nil {
			abs = resolved
		}
	}
	abs = filepath.Clean(abs)
	filePath := filepath.ToSlash(abs)
	if runtime.GOOS == "windows" && !strings.HasPrefix(filePath, "/") {
		filePath = "/" + filePath
	}
	return (&url.URL{Scheme: "file", Path: filePath}).String()
}

func frontmatterBlockRange(content string) *protocol.Range {
	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		return nil
	}
	if strings.TrimSpace(strings.TrimRight(lines[0], "\r")) != "---" {
		return nil
	}

	endLine := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(strings.TrimRight(lines[i], "\r")) == "---" {
			endLine = i
			break
		}
	}
	if endLine == -1 {
		return nil
	}

	end := endLine
	endChar := utf16Len(lines[endLine])
	if endLine+1 < len(lines) {
		end = endLine + 1
		endChar = 0
	}

	return &protocol.Range{
		Start: protocol.Position{Line: 0, Character: 0},
		End:   protocol.Position{Line: clampToUint32(end), Character: endChar},
	}
}

func utf16Len(value string) uint32 {
	if value == "" {
		return 0
	}
	return clampToUint32(len(utf16.Encode([]rune(value))))
}

// RunServer runs the LSP server with the given tool version.
func RunServer(v string) error {
	commonlog.Configure(1, nil)
	s := NewServer(v)
	return s.Run()
}
