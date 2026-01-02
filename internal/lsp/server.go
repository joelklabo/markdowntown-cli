package lsp

import (
	"strings"

	"github.com/spf13/afero"
	"github.com/tliron/commonlog"
	_ "github.com/tliron/commonlog/simple"
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
	"github.com/tliron/glsp/server"
)

const serverName = "markdowntown"

type Server struct {
	version string
	handler *protocol.Handler
	server  *server.Server
	overlay afero.Fs
	base    afero.Fs
	fs      afero.Fs
}

func NewServer(version string) *Server {
	s := &Server{
		version: version,
		overlay: afero.NewMemMapFs(),
		base:    afero.NewOsFs(),
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
	}

	s.server = server.NewServer(s.handler, serverName, false)
	return s
}

func (s *Server) Run() error {
	return s.server.RunStdio()
}

func (s *Server) initialize(context *glsp.Context, params *protocol.InitializeParams) (any, error) {
	capabilities := protocol.ServerCapabilities{
		TextDocumentSync: protocol.TextDocumentSyncKindIncremental,
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
	return afero.WriteFile(s.overlay, path, []byte(params.TextDocument.Text), 0644)
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
	return nil
}

func (s *Server) didClose(context *glsp.Context, params *protocol.DidCloseTextDocumentParams) error {
	path, err := urlToPath(params.TextDocument.URI)
	if err != nil {
		return err
	}
	return s.overlay.Remove(path)
}

func urlToPath(uri string) (string, error) {
	if !strings.HasPrefix(uri, "file://") {
		return uri, nil // Or error?
	}
	return strings.TrimPrefix(uri, "file://"), nil
}

// RunServer starts the LSP server on stdio.
func RunServer(v string) error {
	// Configure logging to stderr
	commonlog.Configure(1, nil)

	s := NewServer(v)
	return s.Run()
}
