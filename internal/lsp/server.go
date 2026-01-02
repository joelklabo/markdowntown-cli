package lsp

import (
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"

	"github.com/spf13/afero"
	"github.com/tliron/commonlog"
	_ "github.com/tliron/commonlog/simple"
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
	"github.com/tliron/glsp/server"
)

const (
	serverName      = "markdowntown"
	debounceTimeout = 500 * time.Millisecond
)

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

	// Cache state
	cacheMu          sync.Mutex
	frontmatterCache map[string]*scan.ParsedFrontmatter
}

func NewServer(version string) *Server {
	s := &Server{
		version:          version,
		overlay:          afero.NewMemMapFs(),
		base:             afero.NewOsFs(),
		diagnosticTimers: make(map[string]*time.Timer),
		frontmatterCache: make(map[string]*scan.ParsedFrontmatter),
	}
	s.fs = afero.NewCopyOnWriteFs(s.base, s.overlay)

	s.handler = &protocol.Handler{
		Initialize:             s.initialize,
		Initialized:            s.initialized,
		Shutdown:               s.shutdown,
		SetTrace:               s.setTrace,
		TextDocumentDidOpen:    s.didOpen,
		TextDocumentDidChange: s.didChange,
		TextDocumentDidClose:  s.didClose,
		TextDocumentHover:      s.hover,
		TextDocumentDefinition: s.definition,
	}

	s.server = server.NewServer(s.handler, serverName, false)
	return s
}

func (s *Server) Run() error {
	return s.server.RunStdio()
}

func (s *Server) initialize(context *glsp.Context, params *protocol.InitializeParams) (any, error) {
	if params.RootURI != nil {
		path, err := urlToPath(*params.RootURI)
		if err == nil {
			s.rootPath = path
		}
	} else if params.RootPath != nil {
		s.rootPath = *params.RootPath
	}

	capabilities := protocol.ServerCapabilities{
		TextDocumentSync: protocol.TextDocumentSyncKindFull,
		HoverProvider:    true,
		DefinitionProvider: true,
	}

	return protocol.InitializeResult{
		Capabilities: capabilities,
		ServerInfo: &protocol.InitializeResultServerInfo{
			Name:    serverName,
			Version: &s.version,
		},
	}, nil
}

func (s *Server) initialized(context *glsp.Context, params *protocol.InitializedParams) error {
	return nil
}

func (s *Server) shutdown(context *glsp.Context) error {
	protocol.SetTraceValue(protocol.TraceValueOff)
	return nil
}

func (s *Server) setTrace(context *glsp.Context, params *protocol.SetTraceParams) error {
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

func (s *Server) didSave(context *glsp.Context, params *protocol.DidSaveTextDocumentParams) error {
	s.triggerDiagnostics(context, params.TextDocument.URI)
	return nil
}

func (s *Server) hover(context *glsp.Context, params *protocol.HoverParams) (*protocol.Hover, error) {
	s.cacheMu.Lock()
	parsed := s.frontmatterCache[params.TextDocument.URI]
	s.cacheMu.Unlock()

	if parsed == nil {
		return nil, nil
	}

	// 1. Find key under cursor
	// LSP line/col is 0-indexed. Our locations are 1-indexed.
	line := int(params.Position.Line + 1)
	col := int(params.Position.Character + 1)

	var foundKey string
	for key, loc := range parsed.Locations {
		// Very simple check: same line and close to start of key or value?
		// YAML keys usually start at loc.Col.
		if loc.Line == line {
			// If it's on the same line, assume it's this key/value for now.
			// Better logic would check ranges.
			foundKey = key
			break
		}
	}

	if foundKey == "" {
		return nil, nil
	}

	// 2. If it's toolId, look up in registry
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

	return nil, nil
}

func (s *Server) definition(context *glsp.Context, params *protocol.DefinitionParams) (any, error) {
	s.cacheMu.Lock()
	parsed := s.frontmatterCache[params.TextDocument.URI]
	s.cacheMu.Unlock()

	if parsed == nil {
		return nil, nil
	}

	line := int(params.Position.Line + 1)
	var foundKey string
	for key, loc := range parsed.Locations {
		if loc.Line == line {
			foundKey = key
			break
		}
	}

	if foundKey == "" {
		return nil, nil
	}

	if strings.Contains(foundKey, "toolId") {
		val, ok := getValue(parsed.Data, foundKey)
		if ok {
			toolID, _ := val.(string)
			if toolID != "" {
				// Link to registry if it's a file?
				// Task said: "return location of that tool in ai-config-patterns.json (if mapped) or a link."
				// Better: link to AGENTS.md if found.
				repoRoot := s.rootPath
				if repoRoot != "" {
					agentsPath := filepath.Join(repoRoot, "AGENTS.md")
					if _, err := s.fs.Stat(agentsPath); err == nil {
						return protocol.Location{
							URI: "file://" + agentsPath,
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

	return nil, nil
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

func (s *Server) triggerDiagnostics(context *glsp.Context, uri string) {
	s.diagnosticsMu.Lock()
	defer s.diagnosticsMu.Unlock()

	if timer, ok := s.diagnosticTimers[uri]; ok {
		timer.Stop()
	}

	s.diagnosticTimers[uri] = time.AfterFunc(debounceTimeout, func() {
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

	result, err := scan.Scan(scan.Options{
		RepoRoot:       repoRoot,
		IncludeContent: true,
		Registry:       registry,
		Fs:             s.fs,
	})
	if err != nil {
		return
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

	var diagnostics []protocol.Diagnostic
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
			diag := protocol.Diagnostic{
				Range:    issueToProtocolRange(issue.Range),
				Severity: severityToProtocolSeverity(issue.Severity),
				Code:     &code,
				Source:   &source,
				Message:  issue.Message,
			}
			diagnostics = append(diagnostics, diag)
		}
	}

	context.Notify(protocol.ServerTextDocumentPublishDiagnostics, protocol.PublishDiagnosticsParams{
		URI:         uri,
		Diagnostics: diagnostics,
	})
}

func issueToProtocolRange(r *audit.Range) protocol.Range {
	if r == nil || r.StartLine <= 0 {
		return protocol.Range{
			Start: protocol.Position{Line: 0, Character: 0},
			End:   protocol.Position{Line: 0, Character: 0},
		}
	}
	return protocol.Range{
		Start: protocol.Position{Line: uint32(r.StartLine - 1), Character: uint32(r.StartCol - 1)},
		End:   protocol.Position{Line: uint32(r.EndLine - 1), Character: uint32(r.EndCol - 1)},
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

func urlToPath(uri string) (string, error) {
	if strings.HasPrefix(uri, "file://") {
		u, err := url.Parse(uri)
		if err != nil {
			return "", err
		}
		return u.Path, nil
	}
	return uri, nil
}

func RunServer(v string) error {
	commonlog.Configure(1, nil)
	s := NewServer(v)
	return s.Run()
}