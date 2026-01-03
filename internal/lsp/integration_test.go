package lsp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/sourcegraph/jsonrpc2"
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

func TestDiagnosticsOverPipe(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	clientConn, serverConn := net.Pipe()
	t.Cleanup(func() {
		_ = clientConn.Close()
		_ = serverConn.Close()
	})

	serverRPC := newServerRPC(t, s, serverConn)
	t.Cleanup(func() {
		_ = serverRPC.Close()
	})

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 1)
	clientRPC := newClientRPC(t, clientConn, diagnostics)
	t.Cleanup(func() {
		_ = clientRPC.Close()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rootURI := pathToURL(repoRoot)
	var initResult protocol.InitializeResult
	if err := clientRPC.Call(ctx, protocol.MethodInitialize, protocol.InitializeParams{
		RootURI: &rootURI,
	}, &initResult); err != nil {
		t.Fatalf("initialize failed: %v", err)
	}
	if err := clientRPC.Notify(ctx, protocol.MethodInitialized, protocol.InitializedParams{}); err != nil {
		t.Fatalf("initialized notify failed: %v", err)
	}

	uri := pathToURL(filepath.Join(repoRoot, "GEMINI.md"))
	content := "---\nkey: value\ninvalid: [\n---\n# Hello"
	if err := os.WriteFile(filepath.Join(repoRoot, "GEMINI.md"), []byte(content), 0o600); err != nil {
		t.Fatalf("write GEMINI.md: %v", err)
	}
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	select {
	case params := <-diagnostics:
		if params.URI != uri {
			t.Fatalf("expected diagnostics for %s, got %s", uri, params.URI)
		}
		if len(params.Diagnostics) == 0 {
			t.Fatal("expected diagnostics, got none")
		}
		found := false
		for _, diag := range params.Diagnostics {
			if diag.Message == "Invalid YAML frontmatter." {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("expected frontmatter diagnostic, got %#v", params.Diagnostics)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for diagnostics")
	}
}

func TestDiagnosticsOverlayOnly(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	clientConn, serverConn := net.Pipe()
	t.Cleanup(func() {
		_ = clientConn.Close()
		_ = serverConn.Close()
	})

	serverRPC := newServerRPC(t, s, serverConn)
	t.Cleanup(func() {
		_ = serverRPC.Close()
	})

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 2)
	clientRPC := newClientRPC(t, clientConn, diagnostics)
	t.Cleanup(func() {
		_ = clientRPC.Close()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rootURI := pathToURL(repoRoot)
	var initResult protocol.InitializeResult
	if err := clientRPC.Call(ctx, protocol.MethodInitialize, protocol.InitializeParams{
		RootURI: &rootURI,
	}, &initResult); err != nil {
		t.Fatalf("initialize failed: %v", err)
	}
	if err := clientRPC.Notify(ctx, protocol.MethodInitialized, protocol.InitializedParams{}); err != nil {
		t.Fatalf("initialized notify failed: %v", err)
	}

	uri := pathToURL(filepath.Join(repoRoot, "GEMINI.md"))
	content := "---\nkey: value\ninvalid: [\n---\n# Hello"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	params := waitForDiagnostics(t, diagnostics, uri)
	if len(params.Diagnostics) == 0 {
		t.Fatal("expected diagnostics for overlay-only file, got none")
	}
}

func TestDiagnosticsDebounceLastChange(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	clientConn, serverConn := net.Pipe()
	t.Cleanup(func() {
		_ = clientConn.Close()
		_ = serverConn.Close()
	})

	serverRPC := newServerRPC(t, s, serverConn)
	t.Cleanup(func() {
		_ = serverRPC.Close()
	})

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 2)
	clientRPC := newClientRPC(t, clientConn, diagnostics)
	t.Cleanup(func() {
		_ = clientRPC.Close()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rootURI := pathToURL(repoRoot)
	var initResult protocol.InitializeResult
	if err := clientRPC.Call(ctx, protocol.MethodInitialize, protocol.InitializeParams{
		RootURI: &rootURI,
	}, &initResult); err != nil {
		t.Fatalf("initialize failed: %v", err)
	}
	if err := clientRPC.Notify(ctx, protocol.MethodInitialized, protocol.InitializedParams{}); err != nil {
		t.Fatalf("initialized notify failed: %v", err)
	}

	uri := pathToURL(filepath.Join(repoRoot, "GEMINI.md"))
	valid := "---\ntoolId: gemini-cli\n---\n# Hello"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: valid,
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	// Drain initial diagnostics from didOpen.
	_ = waitForDiagnostics(t, diagnostics, uri)

	invalid := "---\nkey: value\ninvalid: [\n---\n# Hello"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidChange, protocol.DidChangeTextDocumentParams{
		TextDocument: protocol.VersionedTextDocumentIdentifier{
			TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
		},
		ContentChanges: []any{
			protocol.TextDocumentContentChangeEvent{Text: invalid},
		},
	}); err != nil {
		t.Fatalf("didChange notify failed: %v", err)
	}

	valid2 := "---\ntoolId: gemini-cli\n---\n# Updated"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidChange, protocol.DidChangeTextDocumentParams{
		TextDocument: protocol.VersionedTextDocumentIdentifier{
			TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
		},
		ContentChanges: []any{
			protocol.TextDocumentContentChangeEvent{Text: valid2},
		},
	}); err != nil {
		t.Fatalf("didChange notify failed: %v", err)
	}

	final := waitForDiagnostics(t, diagnostics, uri)
	for _, diag := range final.Diagnostics {
		if diag.Message == "Invalid YAML frontmatter." {
			t.Fatalf("expected final diagnostics to reflect last change, got %q", diag.Message)
		}
	}

	select {
	case <-diagnostics:
		t.Fatalf("expected only one diagnostics publish after debounce")
	case <-time.After(150 * time.Millisecond):
	}
}

func TestServeCanary(t *testing.T) {
	binPath := buildMarkdowntownBinary(t)

	// #nosec G204 -- test harness executes a controlled binary path.
	cmd := exec.Command(binPath, "serve")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdin, err := cmd.StdinPipe()
	if err != nil {
		t.Fatalf("stdin pipe failed: %v", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatalf("stdout pipe failed: %v", err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatalf("start serve failed: %v", err)
	}
	t.Cleanup(func() {
		_ = cmd.Process.Kill()
	})

	stream := procStream{reader: stdout, writer: stdin}
	clientRPC := jsonrpc2.NewConn(context.Background(), jsonrpc2.NewBufferedStream(stream, jsonrpc2.VSCodeObjectCodec{}), jsonrpc2.HandlerWithError(func(context.Context, *jsonrpc2.Conn, *jsonrpc2.Request) (any, error) {
		return nil, nil
	}))
	t.Cleanup(func() {
		_ = clientRPC.Close()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rootURI := pathToURL(t.TempDir())
	var initResult protocol.InitializeResult
	if err := clientRPC.Call(ctx, protocol.MethodInitialize, protocol.InitializeParams{
		RootURI: &rootURI,
	}, &initResult); err != nil {
		t.Fatalf("initialize call failed: %v (stderr: %s)", err, stderr.String())
	}

	var shutdownResult any
	if err := clientRPC.Call(ctx, protocol.MethodShutdown, nil, &shutdownResult); err != nil {
		t.Fatalf("shutdown call failed: %v (stderr: %s)", err, stderr.String())
	}
	if err := clientRPC.Notify(ctx, protocol.MethodExit, nil); err != nil {
		t.Fatalf("exit notify failed: %v (stderr: %s)", err, stderr.String())
	}

	waitCh := make(chan error, 1)
	go func() {
		waitCh <- cmd.Wait()
	}()

	select {
	case err := <-waitCh:
		if err != nil {
			t.Fatalf("serve process exited with error: %v (stderr: %s)", err, stderr.String())
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for serve process to exit (stderr: %s)", stderr.String())
	}
}

func waitForDiagnostics(t *testing.T, diagnostics <-chan protocol.PublishDiagnosticsParams, uri string) protocol.PublishDiagnosticsParams {
	t.Helper()
	select {
	case params := <-diagnostics:
		if params.URI != uri {
			t.Fatalf("expected diagnostics for %s, got %s", uri, params.URI)
		}
		return params
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for diagnostics")
	}
	return protocol.PublishDiagnosticsParams{}
}

func newServerRPC(t *testing.T, s *Server, conn io.ReadWriteCloser) *jsonrpc2.Conn {
	t.Helper()
	handler := jsonrpc2.HandlerWithError(func(ctx context.Context, connection *jsonrpc2.Conn, request *jsonrpc2.Request) (any, error) {
		glspContext := glsp.Context{
			Method: request.Method,
			Notify: func(method string, params any) {
				if err := connection.Notify(ctx, method, params); err != nil {
					t.Logf("notify failed: %v", err)
				}
			},
			Call: func(method string, params any, result any) {
				if err := connection.Call(ctx, method, params, result); err != nil {
					t.Logf("call failed: %v", err)
				}
			},
		}

		if request.Params != nil {
			glspContext.Params = *request.Params
		}

		if request.Method == protocol.MethodExit {
			_ = connection.Close()
			return nil, nil
		}

		r, validMethod, validParams, err := s.handler.Handle(&glspContext)
		if !validMethod {
			return nil, &jsonrpc2.Error{
				Code:    jsonrpc2.CodeMethodNotFound,
				Message: fmt.Sprintf("method not supported: %s", request.Method),
			}
		}
		if !validParams {
			if err != nil {
				return nil, &jsonrpc2.Error{
					Code:    jsonrpc2.CodeInvalidParams,
					Message: err.Error(),
				}
			}
			return nil, &jsonrpc2.Error{Code: jsonrpc2.CodeInvalidParams}
		}
		if err != nil {
			return nil, &jsonrpc2.Error{
				Code:    jsonrpc2.CodeInvalidRequest,
				Message: err.Error(),
			}
		}
		return r, nil
	})

	return jsonrpc2.NewConn(context.Background(), jsonrpc2.NewBufferedStream(conn, jsonrpc2.VSCodeObjectCodec{}), handler)
}

func newClientRPC(t *testing.T, conn io.ReadWriteCloser, diagnostics chan<- protocol.PublishDiagnosticsParams) *jsonrpc2.Conn {
	t.Helper()
	handler := jsonrpc2.HandlerWithError(func(_ context.Context, _ *jsonrpc2.Conn, request *jsonrpc2.Request) (any, error) {
		if request.Method != protocol.ServerTextDocumentPublishDiagnostics || request.Params == nil {
			return nil, nil
		}

		var params protocol.PublishDiagnosticsParams
		if err := json.Unmarshal(*request.Params, &params); err != nil {
			return nil, err
		}
		select {
		case diagnostics <- params:
		default:
		}
		return nil, nil
	})

	return jsonrpc2.NewConn(context.Background(), jsonrpc2.NewBufferedStream(conn, jsonrpc2.VSCodeObjectCodec{}), handler)
}

func buildMarkdowntownBinary(t *testing.T) string {
	t.Helper()
	binName := "markdowntown"
	if runtime.GOOS == "windows" {
		binName += ".exe"
	}
	binPath := filepath.Join(t.TempDir(), binName)
	repoRoot := findRepoRoot(t)
	// #nosec G204 -- test harness builds a local binary with fixed args.
	cmd := exec.Command("go", "build", "-o", binPath, "./cmd/markdowntown")
	cmd.Env = os.Environ()
	cmd.Dir = repoRoot
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("go build failed: %v\nOutput: %s", err, out)
	}
	return binPath
}

func findRepoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd failed: %v", err)
	}
	for {
		if _, err := os.Stat(filepath.Join(wd, "go.mod")); err == nil {
			return wd
		}
		parent := filepath.Dir(wd)
		if parent == wd {
			t.Fatal("could not find repo root")
		}
		wd = parent
	}
}

type procStream struct {
	reader io.ReadCloser
	writer io.WriteCloser
}

func (p procStream) Read(buf []byte) (int, error) {
	return p.reader.Read(buf)
}

func (p procStream) Write(buf []byte) (int, error) {
	return p.writer.Write(buf)
}

func (p procStream) Close() error {
	if err := p.writer.Close(); err != nil {
		return err
	}
	return p.reader.Close()
}
