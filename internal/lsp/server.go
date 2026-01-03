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
		return nil, nil
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
		return nil, nil
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

	return nil, nil
}

func (s *Server) definition(_ *glsp.Context, params *protocol.DefinitionParams) (any, error) {
	s.cacheMu.Lock()
	parsed := s.frontmatterCache[params.TextDocument.URI]
	s.cacheMu.Unlock()

	if parsed == nil {
		return nil, nil
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
		return nil, nil
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

	return nil, nil
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

// RunServer runs the LSP server with the given tool version.
func RunServer(v string) error {
	commonlog.Configure(1, nil)
	s := NewServer(v)
	return s.Run()
}
