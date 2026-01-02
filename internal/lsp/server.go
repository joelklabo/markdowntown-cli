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
}

func NewServer(version string) *Server {
	s := &Server{
		version:          version,
		overlay:          afero.NewMemMapFs(),
		base:             afero.NewOsFs(),
		diagnosticTimers: make(map[string]*time.Timer),
	}
	s.fs = afero.NewCopyOnWriteFs(s.base, s.overlay)

	s.handler = &protocol.Handler{
		Initialize:             s.initialize,
		Initialized:            s.initialized,
		Shutdown:               s.shutdown,
		SetTrace:               s.setTrace,
		TextDocumentDidOpen:    s.didOpen,
		TextDocumentDidChange: s.didChange,
		TextDocumentDidSave:   s.didSave,
		TextDocumentDidClose:  s.didClose,
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
	s.triggerDiagnostics(context, params.TextDocument.URI)
	return nil
}

func (s *Server) didChange(context *glsp.Context, params *protocol.DidChangeTextDocumentParams) error {
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return err
	}

	// Handle full content sync first as per task notes
	for _, change := range params.ContentChanges {
		if c, ok := change.(protocol.TextDocumentContentChangeEvent); ok {
			err = afero.WriteFile(s.overlay, path, []byte(c.Text), 0644)
			if err != nil {
				return err
			}
		}
	}
	s.triggerDiagnostics(context, params.TextDocument.URI)
	return nil
}

func (s *Server) didSave(context *glsp.Context, params *protocol.DidSaveTextDocumentParams) error {
	s.triggerDiagnostics(context, params.TextDocument.URI)
	return nil
}

func (s *Server) didClose(context *glsp.Context, params *protocol.DidCloseTextDocumentParams) error {
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return err
	}
	return s.overlay.Remove(path)
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