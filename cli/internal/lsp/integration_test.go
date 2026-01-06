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
	"strconv"
	"strings"
	"testing"
	"time"

	"go.uber.org/goleak"

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
		diag := requireDiagnostic(t, params.Diagnostics, "MD003")
		if !strings.HasPrefix(diag.Message, "Invalid YAML frontmatter") {
			t.Fatalf("expected frontmatter diagnostic, got %#v", params.Diagnostics)
		}
		requireDiagnosticSuggestion(t, diag)
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for diagnostics")
	}
}

func TestDocumentSymbolsOverPipe(t *testing.T) {
	s := NewServer("0.1.0")
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

	uri := pathToURL(filepath.Join(repoRoot, "AGENTS.md"))
	content := "---\ntoolId: gemini-cli\nscope: repo\n---\n# Hello"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	var symbols []protocol.DocumentSymbol
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentDocumentSymbol, protocol.DocumentSymbolParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
	}, &symbols); err != nil {
		t.Fatalf("documentSymbol failed: %v", err)
	}
	if len(symbols) != 1 {
		t.Fatalf("expected root symbol, got %#v", symbols)
	}
	root := symbols[0]
	if root.Name != "Frontmatter" {
		t.Fatalf("expected Frontmatter root, got %q", root.Name)
	}
	if root.Kind != protocol.SymbolKindObject {
		t.Fatalf("expected root kind object, got %d", root.Kind)
	}
	if !findDocumentSymbolByName(root.Children, "toolId") {
		t.Fatalf("expected toolId symbol, got %#v", root.Children)
	}
	if !findDocumentSymbolByName(root.Children, "scope") {
		t.Fatalf("expected scope symbol, got %#v", root.Children)
	}
}

func TestDefinitionRegistryOverPipe(t *testing.T) {
	s := NewServer("0.1.0")
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
	content := "---\ntoolId: gemini-cli\n---\n# Hello"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	var loc protocol.Location
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentDefinition, protocol.DefinitionParams{
		TextDocumentPositionParams: protocol.TextDocumentPositionParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: uri},
			Position:     protocol.Position{Line: 1, Character: 8},
		},
	}, &loc); err != nil {
		t.Fatalf("definition failed: %v", err)
	}

	if !strings.Contains(loc.URI, "ai-config-patterns.json") {
		t.Fatalf("expected registry definition, got %s", loc.URI)
	}
	if loc.Range.Start.Line == 0 && loc.Range.End.Line == 0 {
		t.Fatalf("expected registry range, got %+v", loc.Range)
	}
}

func TestLeakShutdown(t *testing.T) {
	defer goleak.VerifyNone(t, goleakOptions()...)

	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	clientConn, serverConn := net.Pipe()
	defer func() {
		_ = clientConn.Close()
		_ = serverConn.Close()
	}()

	serverRPC := newServerRPC(t, s, serverConn)
	defer func() {
		_ = serverRPC.Close()
	}()

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 1)
	clientRPC := newClientRPC(t, clientConn, diagnostics)
	defer func() {
		_ = clientRPC.Close()
	}()

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

	var shutdownResult any
	if err := clientRPC.Call(ctx, protocol.MethodShutdown, nil, &shutdownResult); err != nil {
		t.Fatalf("shutdown failed: %v", err)
	}
	if err := clientRPC.Notify(ctx, protocol.MethodExit, nil); err != nil {
		t.Fatalf("exit notify failed: %v", err)
	}
}

func TestDiagnosticsMetadataIncludesTagsAndCodeDescription(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	if err := os.WriteFile(filepath.Join(repoRoot, ".gitignore"), []byte("AGENTS.md\n"), 0o600); err != nil {
		t.Fatalf("write .gitignore: %v", err)
	}

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
	caps := protocol.ClientCapabilities{
		TextDocument: &protocol.TextDocumentClientCapabilities{
			PublishDiagnostics: &protocol.PublishDiagnosticsClientCapabilities{
				RelatedInformation:     boolPtr(true),
				CodeDescriptionSupport: boolPtr(true),
				TagSupport: &struct {
					ValueSet []protocol.DiagnosticTag `json:"valueSet"`
				}{
					ValueSet: []protocol.DiagnosticTag{protocol.DiagnosticTagUnnecessary},
				},
			},
		},
	}
	var initResult protocol.InitializeResult
	if err := clientRPC.Call(ctx, protocol.MethodInitialize, protocol.InitializeParams{
		RootURI:      &rootURI,
		Capabilities: caps,
	}, &initResult); err != nil {
		t.Fatalf("initialize failed: %v", err)
	}
	if err := clientRPC.Notify(ctx, protocol.MethodInitialized, protocol.InitializedParams{}); err != nil {
		t.Fatalf("initialized notify failed: %v", err)
	}

	uri := pathToURL(filepath.Join(repoRoot, "AGENTS.md"))
	content := "# Hello"
	if err := os.WriteFile(filepath.Join(repoRoot, "AGENTS.md"), []byte(content), 0o600); err != nil {
		t.Fatalf("write AGENTS.md: %v", err)
	}
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	params := waitForDiagnostics(t, diagnostics, uri)
	diag := requireDiagnostic(t, params.Diagnostics, "MD002")
	if diag.CodeDescription == nil || !strings.Contains(diag.CodeDescription.HRef, "docs/audit-spec-v1.md") {
		t.Fatalf("expected code description for MD002, got %#v", diag.CodeDescription)
	}
	if !diagnosticHasTag(diag, protocol.DiagnosticTagUnnecessary) {
		t.Fatalf("expected unnecessary tag, got %#v", diag.Tags)
	}
}

func TestDiagnosticsRelatedInfoSettingDisabled(t *testing.T) {
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
	initOptions := map[string]any{
		"diagnostics": map[string]any{
			"includeRelatedInfo": false,
		},
	}
	caps := protocol.ClientCapabilities{
		TextDocument: &protocol.TextDocumentClientCapabilities{
			PublishDiagnostics: &protocol.PublishDiagnosticsClientCapabilities{
				RelatedInformation: boolPtr(true),
			},
		},
	}
	var initResult protocol.InitializeResult
	if err := clientRPC.Call(ctx, protocol.MethodInitialize, protocol.InitializeParams{
		RootURI:               &rootURI,
		Capabilities:          caps,
		InitializationOptions: initOptions,
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

	params := waitForDiagnostics(t, diagnostics, uri)
	diag := requireDiagnostic(t, params.Diagnostics, "MD003")
	if len(diag.RelatedInformation) > 0 {
		t.Fatalf("expected related info to be disabled, got %#v", diag.RelatedInformation)
	}
}

func TestDiagnosticsRulesDisabled(t *testing.T) {
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
	initOptions := map[string]any{
		"diagnostics": map[string]any{
			"rulesDisabled": []string{"MD003"},
		},
	}
	var initResult protocol.InitializeResult
	if err := clientRPC.Call(ctx, protocol.MethodInitialize, protocol.InitializeParams{
		RootURI:               &rootURI,
		InitializationOptions: initOptions,
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

	params := waitForDiagnostics(t, diagnostics, uri)
	for _, diag := range params.Diagnostics {
		if diag.Code != nil && diag.Code.Value == "MD003" {
			t.Fatalf("expected MD003 to be suppressed, got %#v", params.Diagnostics)
		}
	}
}

func TestDiagnosticsSeverityOverride(t *testing.T) {
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
	initOptions := map[string]any{
		"diagnostics": map[string]any{
			"severityOverrides": map[string]any{"MD003": "info"},
		},
	}
	var initResult protocol.InitializeResult
	if err := clientRPC.Call(ctx, protocol.MethodInitialize, protocol.InitializeParams{
		RootURI:               &rootURI,
		InitializationOptions: initOptions,
	}, &initResult); err != nil {
		t.Fatalf("initialize failed: %v", err)
	}
	if err := clientRPC.Notify(ctx, protocol.MethodInitialized, protocol.InitializedParams{}); err != nil {
		t.Fatalf("initialized notify failed: %v", err)
	}
	if got, ok := s.currentSettings().Diagnostics.SeverityOverrides["MD003"]; !ok || strings.ToLower(string(got)) != "info" {
		t.Fatalf("expected severity override to be applied, got %#v", s.currentSettings().Diagnostics.SeverityOverrides)
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

	params := waitForDiagnostics(t, diagnostics, uri)
	diag := requireDiagnostic(t, params.Diagnostics, "MD003")
	if diag.Severity == nil {
		t.Fatalf("expected info severity, got nil")
	}
	if *diag.Severity != protocol.DiagnosticSeverityInformation {
		t.Fatalf("expected info severity, got %v", *diag.Severity)
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
		if strings.Contains(diag.Message, "Invalid YAML frontmatter") {
			t.Fatalf("expected final diagnostics to reflect last change, got %q", diag.Message)
		}
	}

	select {
	case <-diagnostics:
		t.Fatalf("expected only one diagnostics publish after debounce")
	case <-time.After(150 * time.Millisecond):
	}
}

func TestDiagnosticsDebounceOutOfOrderChanges(t *testing.T) {
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

	_ = waitForDiagnostics(t, diagnostics, uri)

	invalid := "---\nkey: value\ninvalid: [\n---\n# Hello"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidChange, protocol.DidChangeTextDocumentParams{
		TextDocument: protocol.VersionedTextDocumentIdentifier{
			TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
			Version:                2,
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
			Version:                1,
		},
		ContentChanges: []any{
			protocol.TextDocumentContentChangeEvent{Text: valid2},
		},
	}); err != nil {
		t.Fatalf("didChange notify failed: %v", err)
	}

	final := waitForDiagnostics(t, diagnostics, uri)
	diag := requireDiagnostic(t, final.Diagnostics, "MD003")
	if !strings.Contains(diag.Message, "Invalid YAML frontmatter") {
		t.Fatalf("expected stale update to be ignored, got %q", diag.Message)
	}

	select {
	case <-diagnostics:
		t.Fatalf("expected only one diagnostics publish after debounce")
	case <-time.After(150 * time.Millisecond):
	}
}

func TestDiagnosticsDidCloseCancelsDebounce(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 100 * time.Millisecond
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

	_ = waitForDiagnostics(t, diagnostics, uri)

	invalid := "---\nkey: value\ninvalid: [\n---\n# Hello"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidChange, protocol.DidChangeTextDocumentParams{
		TextDocument: protocol.VersionedTextDocumentIdentifier{
			TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
			Version:                1,
		},
		ContentChanges: []any{
			protocol.TextDocumentContentChangeEvent{Text: invalid},
		},
	}); err != nil {
		t.Fatalf("didChange notify failed: %v", err)
	}

	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidClose, protocol.DidCloseTextDocumentParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
	}); err != nil {
		t.Fatalf("didClose notify failed: %v", err)
	}

	select {
	case params := <-diagnostics:
		t.Fatalf("expected no diagnostics after close, got %+v", params)
	case <-time.After(200 * time.Millisecond):
	}
}

func TestDiagnosticsSettingsChangeRefresh(t *testing.T) {
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

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 5)
	clientRPC := newClientRPC(t, clientConn, diagnostics)
	t.Cleanup(func() {
		_ = clientRPC.Close()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
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
	invalid := "---\nkey: value\ninvalid: [\n---\n# Hello"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: invalid,
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	// Get initial diagnostics with MD003 for invalid frontmatter
	initial := waitForDiagnostics(t, diagnostics, uri)
	_ = requireDiagnostic(t, initial.Diagnostics, "MD003")

	// Send workspace/didChangeConfiguration to disable MD003
	if err := clientRPC.Notify(ctx, protocol.MethodWorkspaceDidChangeConfiguration, protocol.DidChangeConfigurationParams{
		Settings: map[string]any{
			"markdowntown": map[string]any{
				"diagnostics": map[string]any{
					"rulesDisabled": []string{"MD003"},
				},
			},
		},
	}); err != nil {
		t.Fatalf("didChangeConfiguration notify failed: %v", err)
	}

	// Wait for diagnostics refresh after settings change
	refreshed := waitForDiagnostics(t, diagnostics, uri)

	// Verify MD003 is no longer in diagnostics
	for _, diag := range refreshed.Diagnostics {
		if diagnosticRuleID(diag) == "MD003" {
			t.Fatalf("expected MD003 to be disabled after settings change, got %#v", refreshed.Diagnostics)
		}
	}

	// Verify no additional diagnostics arrive after debounce
	select {
	case params := <-diagnostics:
		t.Fatalf("unexpected additional diagnostics: %+v", params)
	case <-time.After(150 * time.Millisecond):
	}
}

func TestDiagnosticsRapidOpenClose(t *testing.T) {
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

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 5)
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

	// Rapidly open, change, and close.
	for i := 0; i < 3; i++ {
		if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
			TextDocument: protocol.TextDocumentItem{
				URI:     uri,
				Version: protocol.Integer(i),
				Text:    content,
			},
		}); err != nil {
			t.Fatalf("didOpen notify failed: %v", err)
		}
		if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidClose, protocol.DidCloseTextDocumentParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		}); err != nil {
			t.Fatalf("didClose notify failed: %v", err)
		}
	}

	select {
	case params := <-diagnostics:
		t.Fatalf("expected no diagnostics after rapid open/close, got %+v", params)
	case <-time.After(200 * time.Millisecond):
	}
}

func TestDiagnosticsRaceClose(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 20 * time.Millisecond
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

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 5)
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

	// Wait for debounce to almost expire, then close.
	time.Sleep(15 * time.Millisecond)
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidClose, protocol.DidCloseTextDocumentParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
	}); err != nil {
		t.Fatalf("didClose notify failed: %v", err)
	}

	select {
	case params := <-diagnostics:
		// We might get the one from didOpen if it fired fast, but we should NOT get one after didClose.
		// To be strict, we drain the one from didOpen first.
		t.Logf("Received diagnostic: %v", params.URI)
	case <-time.After(100 * time.Millisecond):
	}

	// Verify no more diagnostics arrive.
	select {
	case params := <-diagnostics:
		t.Fatalf("unexpected diagnostics after close: %+v", params)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestDiagnosticsRapidOpenChangeClose(t *testing.T) {
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

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 10)
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
	content := "---\ntoolId: gemini-cli\n---\n# Hello"

	for i := 0; i < 5; i++ {
		_ = clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
			TextDocument: protocol.TextDocumentItem{
				URI:     uri,
				Version: 1,
				Text:    content,
			},
		})
		_ = clientRPC.Notify(ctx, protocol.MethodTextDocumentDidChange, protocol.DidChangeTextDocumentParams{
			TextDocument: protocol.VersionedTextDocumentIdentifier{
				TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
				Version:                2,
			},
			ContentChanges: []any{
				protocol.TextDocumentContentChangeEvent{Text: content + "\nchange"},
			},
		})
		_ = clientRPC.Notify(ctx, protocol.MethodTextDocumentDidClose, protocol.DidCloseTextDocumentParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		})
	}

	// Wait long enough for any leaked timers to fire.
	time.Sleep(150 * time.Millisecond)

	// Verify no diagnostics arrive.
	select {
	case params := <-diagnostics:
		t.Fatalf("unexpected diagnostics after rapid open/change/close: %+v", params)
	default:
	}
}

func TestDiagnosticsRapidOpenCloseOpen(t *testing.T) {
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

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 10)
	clientRPC := newClientRPC(t, clientConn, diagnostics)
	t.Cleanup(func() {
		_ = clientRPC.Close()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
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
	content := "---\ntoolId: gemini-cli\n---\n# Hello"

	// Rapid open/close/open pattern: open file, close it quickly, then reopen
	for i := int32(0); i < 3; i++ {
		// Open
		if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
			TextDocument: protocol.TextDocumentItem{
				URI:     uri,
				Version: i*2 + 1,
				Text:    content,
			},
		}); err != nil {
			t.Fatalf("didOpen notify failed: %v", err)
		}

		// Close immediately (before debounce expires)
		time.Sleep(10 * time.Millisecond) // Less than debounce delay
		if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidClose, protocol.DidCloseTextDocumentParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		}); err != nil {
			t.Fatalf("didClose notify failed: %v", err)
		}

		time.Sleep(10 * time.Millisecond)
	}

	// Final open and wait for diagnostics
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:     uri,
			Version: 100,
			Text:    content,
		},
	}); err != nil {
		t.Fatalf("final didOpen notify failed: %v", err)
	}

	// Should receive diagnostics for the final open
	params := waitForDiagnostics(t, diagnostics, uri)
	if len(params.Diagnostics) == 0 {
		t.Fatal("expected diagnostics for final open")
	}

	// Drain any stale diagnostics from the rapid cycles
	drainedCount := 0
	for {
		select {
		case <-diagnostics:
			drainedCount++
			if drainedCount > 10 {
				t.Fatal("too many stale diagnostics")
			}
		case <-time.After(150 * time.Millisecond):
			return // All diagnostics drained
		}
	}
}

func TestDiagnosticsConflict(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	dir := filepath.Join(repoRoot, ".github", "instructions")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("mkdir instructions dir: %v", err)
	}
	paths := []string{
		filepath.Join(dir, "a.instructions.md"),
		filepath.Join(dir, "b.instructions.md"),
	}
	for _, path := range paths {
		if err := os.WriteFile(path, []byte("# Instruction\n"), 0o600); err != nil {
			t.Fatalf("write instructions file: %v", err)
		}
	}

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

	uri := pathToURL(paths[0])
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: "# Instruction\n",
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	params := waitForDiagnostics(t, diagnostics, uri)
	diag := requireDiagnostic(t, params.Diagnostics, "MD001")
	requireDiagnosticSuggestion(t, diag)
}

func TestDiagnosticsDuplicateFrontmatter(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	paths := []string{
		filepath.Join(repoRoot, ".codex", "skills", "one", "SKILL.md"),
		filepath.Join(repoRoot, ".codex", "skills", "two", "SKILL.md"),
	}
	for _, path := range paths {
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatalf("mkdir skill dir: %v", err)
		}
		content := "---\nname: shared\n---\n# Skill\n"
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatalf("write skill file: %v", err)
		}
	}

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

	uri := pathToURL(paths[0])
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: "---\nname: shared\n---\n# Skill\n",
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	params := waitForDiagnostics(t, diagnostics, uri)
	diag := requireDiagnostic(t, params.Diagnostics, "MD007")
	requireDiagnosticSuggestion(t, diag)
}

func TestDiagnosticsUnreadable(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("chmod not supported on windows")
	}

	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	path := filepath.Join(repoRoot, "AGENTS.md")
	if err := os.WriteFile(path, []byte("# Locked\n"), 0o600); err != nil {
		t.Fatalf("write AGENTS.md: %v", err)
	}
	if err := os.Chmod(path, 0); err != nil {
		t.Fatalf("chmod AGENTS.md: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chmod(path, 0o600)
	})

	uri := pathToURL(path)
	diagnostics := make(chan protocol.PublishDiagnosticsParams, 1)
	ctx := &glsp.Context{
		Notify: func(method string, params any) {
			if method != protocol.ServerTextDocumentPublishDiagnostics {
				return
			}
			payload, ok := params.(protocol.PublishDiagnosticsParams)
			if !ok {
				return
			}
			select {
			case diagnostics <- payload:
			default:
			}
		},
	}
	s.rootPath = repoRoot
	s.runDiagnostics(ctx, uri)

	params := waitForDiagnostics(t, diagnostics, uri)
	_ = requireDiagnostic(t, params.Diagnostics, "MD006")
}

func TestCodeActionRemoveInvalidFrontmatter(t *testing.T) {
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

	uri := pathToURL(filepath.Join(repoRoot, "AGENTS.md"))
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
		t.Fatal("expected diagnostics for invalid frontmatter")
	}

	var actions []protocol.CodeAction
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeAction, protocol.CodeActionParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		Range:        protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
		Context:      protocol.CodeActionContext{Diagnostics: params.Diagnostics},
	}, &actions); err != nil {
		t.Fatalf("codeAction request failed: %v", err)
	}

	found := false
	for _, action := range actions {
		if action.Title != "Remove invalid frontmatter block" {
			continue
		}
		if action.Edit == nil {
			t.Fatalf("expected edit for code action")
		}
		edits := action.Edit.Changes[uri]
		if len(edits) == 0 {
			t.Fatalf("expected text edits for uri %s", uri)
		}
		if edits[0].NewText != "" {
			t.Fatalf("expected quick fix to remove text, got %q", edits[0].NewText)
		}
		found = true
		break
	}
	if !found {
		t.Fatalf("expected quick fix action, got %#v", actions)
	}
}

func TestCodeActionInsertPlaceholder(t *testing.T) {
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

	uri := pathToURL(filepath.Join(repoRoot, "AGENTS.md"))
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: "",
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	params := waitForDiagnostics(t, diagnostics, uri)
	if len(params.Diagnostics) == 0 {
		t.Fatal("expected diagnostics for empty config")
	}

	var actions []protocol.CodeAction
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeAction, protocol.CodeActionParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		Range:        protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
		Context:      protocol.CodeActionContext{Diagnostics: params.Diagnostics},
	}, &actions); err != nil {
		t.Fatalf("codeAction request failed: %v", err)
	}

	assertActionContainsText(t, actions, actionTitleInsertPlaceholder, "# Instructions")
}

func TestCodeActionAllowGitignore(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	if err := os.WriteFile(filepath.Join(repoRoot, ".gitignore"), []byte("AGENTS.md\n"), 0o600); err != nil {
		t.Fatalf("write .gitignore: %v", err)
	}

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

	uri := pathToURL(filepath.Join(repoRoot, "AGENTS.md"))
	content := "# Hello"
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
		t.Fatal("expected diagnostics for gitignored config")
	}

	var actions []protocol.CodeAction
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeAction, protocol.CodeActionParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		Range:        protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
		Context:      protocol.CodeActionContext{Diagnostics: params.Diagnostics},
	}, &actions); err != nil {
		t.Fatalf("codeAction request failed: %v", err)
	}

	assertActionContainsText(t, actions, actionTitleAllowGitignoreEntry, "!AGENTS.md")
}

func TestCodeActionCreateRepoConfig(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	tempHome := t.TempDir()
	codexHome := filepath.Join(tempHome, ".codex")
	t.Setenv("HOME", tempHome)
	t.Setenv("CODEX_HOME", codexHome)

	if err := os.MkdirAll(codexHome, 0o700); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}

	userAgents := filepath.Join(codexHome, "AGENTS.md")
	if err := os.WriteFile(userAgents, []byte("# User\n"), 0o600); err != nil {
		t.Fatalf("write user AGENTS.md: %v", err)
	}

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

	uri := pathToURL(userAgents)
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: "# User\n",
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	params := waitForDiagnostics(t, diagnostics, uri)
	if len(params.Diagnostics) == 0 {
		t.Fatal("expected diagnostics for missing repo config")
	}

	var actions []protocol.CodeAction
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeAction, protocol.CodeActionParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		Range:        protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
		Context:      protocol.CodeActionContext{Diagnostics: params.Diagnostics},
	}, &actions); err != nil {
		t.Fatalf("codeAction request failed: %v", err)
	}

	found := false
	for _, action := range actions {
		if !strings.HasPrefix(action.Title, actionTitleCreateRepoPrefix) {
			continue
		}
		found = true
		if !actionHasEditText(action, "# Instructions") {
			t.Fatalf("expected repo config quick fix to include stub content, got %#v", action.Edit)
		}
		break
	}
	if !found {
		t.Fatalf("expected repo config quick fix, got %#v", actions)
	}
}

func TestCodeActionRemoveDuplicateFrontmatter(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	paths := []string{
		filepath.Join(repoRoot, ".codex", "skills", "one", "SKILL.md"),
		filepath.Join(repoRoot, ".codex", "skills", "two", "SKILL.md"),
	}
	for _, path := range paths {
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatalf("mkdir skill dir: %v", err)
		}
		content := "---\nname: shared\n---\n# Skill\n"
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatalf("write skill file: %v", err)
		}
	}

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

	uri := pathToURL(paths[0])
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: "---\nname: shared\n---\n# Skill\n",
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	params := waitForDiagnostics(t, diagnostics, uri)
	if len(params.Diagnostics) == 0 {
		t.Fatal("expected diagnostics for duplicate frontmatter")
	}

	var actions []protocol.CodeAction
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeAction, protocol.CodeActionParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		Range:        protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
		Context:      protocol.CodeActionContext{Diagnostics: params.Diagnostics},
	}, &actions); err != nil {
		t.Fatalf("codeAction request failed: %v", err)
	}

	found := false
	for _, action := range actions {
		if !strings.HasPrefix(action.Title, actionTitleRemoveDuplicateFrontmatterPrefix) {
			continue
		}
		found = true
		if action.Edit == nil {
			t.Fatalf("expected edit for duplicate frontmatter action")
		}
		edits := action.Edit.Changes[uri]
		if len(edits) == 0 {
			t.Fatalf("expected text edits for uri %s", uri)
		}
		if edits[0].NewText != "" {
			t.Fatalf("expected quick fix to remove text, got %q", edits[0].NewText)
		}
		if edits[0].Range.Start.Line != 1 || edits[0].Range.End.Line != 2 {
			t.Fatalf("unexpected delete range: %#v", edits[0].Range)
		}
		break
	}
	if !found {
		t.Fatalf("expected duplicate frontmatter quick fix, got %#v", actions)
	}
}

func TestCodeActionInsertFrontmatter(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	path := filepath.Join(repoRoot, ".codex", "skills", "alpha", "SKILL.md")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("mkdir skills dir: %v", err)
	}
	content := "# Skill\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write skill file: %v", err)
	}

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

	uri := pathToURL(path)
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	params := waitForDiagnostics(t, diagnostics, uri)
	diag := requireDiagnostic(t, params.Diagnostics, "MD012")
	requireDiagnosticSuggestion(t, diag)

	var actions []protocol.CodeAction
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeAction, protocol.CodeActionParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		Range:        protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
		Context:      protocol.CodeActionContext{Diagnostics: params.Diagnostics},
	}, &actions); err != nil {
		t.Fatalf("codeAction request failed: %v", err)
	}

	assertActionContainsText(t, actions, actionTitleInsertFrontmatterPrefix+"name", "name: alpha")
}

func TestCodeActionReplaceToolID(t *testing.T) {
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
	content := "---\ntoolId: gemini-clu\n---\n# Hello\n"
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	params := waitForDiagnostics(t, diagnostics, uri)
	diag := requireDiagnostic(t, params.Diagnostics, "MD015")
	requireDiagnosticSuggestion(t, diag)

	var actions []protocol.CodeAction
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeAction, protocol.CodeActionParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		Range:        protocol.Range{Start: protocol.Position{Line: 1, Character: 0}, End: protocol.Position{Line: 1, Character: 0}},
		Context:      protocol.CodeActionContext{Diagnostics: params.Diagnostics},
	}, &actions); err != nil {
		t.Fatalf("codeAction request failed: %v", err)
	}

	assertActionContainsText(t, actions, actionTitleReplaceToolIDPrefix+"gemini-cli", "gemini-cli")
}

func TestCodeActionDisableRule(t *testing.T) {
	s := NewServer("0.1.0")
	s.Debounce = 50 * time.Millisecond
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	settingsDir := filepath.Join(repoRoot, ".vscode")
	if err := os.MkdirAll(settingsDir, 0o700); err != nil {
		t.Fatalf("mkdir settings dir: %v", err)
	}
	settingsPath := filepath.Join(settingsDir, "settings.json")
	if err := os.WriteFile(settingsPath, []byte("{\n  \"editor.tabSize\": 2\n}\n"), 0o600); err != nil {
		t.Fatalf("write settings.json: %v", err)
	}

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

	uri := pathToURL(filepath.Join(repoRoot, "AGENTS.md"))
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
		t.Fatal("expected diagnostics for invalid frontmatter")
	}

	var actions []protocol.CodeAction
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeAction, protocol.CodeActionParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
		Range:        protocol.Range{Start: protocol.Position{Line: 0, Character: 0}, End: protocol.Position{Line: 0, Character: 0}},
		Context:      protocol.CodeActionContext{Diagnostics: params.Diagnostics},
	}, &actions); err != nil {
		t.Fatalf("codeAction request failed: %v", err)
	}

	assertActionContainsText(t, actions, actionTitleDisableRulePrefix+"MD003", "markdowntown.diagnostics.rulesDisabled")
	assertActionContainsText(t, actions, actionTitleDisableRulePrefix+"MD003", "MD003")
}

func TestCodeLensShadowedByOverride(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	basePath := filepath.Join(repoRoot, "AGENTS.md")
	overridePath := filepath.Join(repoRoot, "AGENTS.override.md")
	if err := os.WriteFile(basePath, []byte("# Base"), 0o600); err != nil {
		t.Fatalf("write AGENTS.md: %v", err)
	}
	if err := os.WriteFile(overridePath, []byte("# Override"), 0o600); err != nil {
		t.Fatalf("write AGENTS.override.md: %v", err)
	}

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

	uri := pathToURL(basePath)
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: "# Base",
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}

	var lenses []protocol.CodeLens
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeLens, protocol.CodeLensParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
	}, &lenses); err != nil {
		t.Fatalf("codeLens failed: %v", err)
	}

	if len(lenses) == 0 {
		t.Fatal("expected code lens, got none")
	}

	found := false
	for _, lens := range lenses {
		if lens.Command == nil {
			continue
		}
		if lens.Command.Title == "Shadowed by AGENTS.override.md" {
			found = true
		}
		if lens.Range.Start.Line != 0 {
			t.Fatalf("expected code lens to start at line 0, got %d", lens.Range.Start.Line)
		}
	}
	if !found {
		t.Fatalf("expected shadowed code lens, got %#v", lenses)
	}
}

// TestCodeLensCacheInvalidation verifies that CodeLens results are updated
// after file changes, demonstrating that the scan cache is properly invalidated.
func TestCodeLensCacheInvalidation(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	setRegistryEnv(t)

	agentsPath := filepath.Join(repoRoot, "AGENTS.md")
	overridePath := filepath.Join(repoRoot, "AGENTS.override.md")

	// Initially, only AGENTS.md exists (should be "Active")
	if err := os.WriteFile(agentsPath, []byte("---\ntoolId: claude-3-opus\n---\n# Base"), 0o600); err != nil {
		t.Fatalf("write AGENTS.md: %v", err)
	}

	clientConn, serverConn := net.Pipe()
	t.Cleanup(func() {
		_ = clientConn.Close()
		_ = serverConn.Close()
	})

	serverRPC := newServerRPC(t, s, serverConn)
	t.Cleanup(func() {
		_ = serverRPC.Close()
	})

	diagnostics := make(chan protocol.PublishDiagnosticsParams, 10)
	clientRPC := newClientRPC(t, clientConn, diagnostics)
	t.Cleanup(func() {
		_ = clientRPC.Close()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rootURI := pathToURL(repoRoot)
	initializeLSPClient(t, ctx, clientRPC, rootURI)

	uri := pathToURL(agentsPath)
	testCodeLensCacheActive(t, ctx, clientRPC, diagnostics, uri, agentsPath)
	testCodeLensCacheShadowed(t, ctx, clientRPC, diagnostics, uri, overridePath)
	testCodeLensCacheActiveAfterRemoval(t, ctx, clientRPC, diagnostics, uri, overridePath)
}

func initializeLSPClient(t *testing.T, ctx context.Context, clientRPC *jsonrpc2.Conn, rootURI string) {
	t.Helper()
	var initResult protocol.InitializeResult
	if err := clientRPC.Call(ctx, protocol.MethodInitialize, protocol.InitializeParams{
		RootURI: &rootURI,
		Capabilities: protocol.ClientCapabilities{
			TextDocument: &protocol.TextDocumentClientCapabilities{
				PublishDiagnostics: &protocol.PublishDiagnosticsClientCapabilities{
					RelatedInformation:     boolPtr(true),
					CodeDescriptionSupport: boolPtr(true),
					TagSupport: &struct {
						ValueSet []protocol.DiagnosticTag `json:"valueSet"`
					}{
						ValueSet: []protocol.DiagnosticTag{1, 2},
					},
				},
			},
		},
	}, &initResult); err != nil {
		t.Fatalf("initialize failed: %v", err)
	}
	if err := clientRPC.Notify(ctx, protocol.MethodInitialized, protocol.InitializedParams{}); err != nil {
		t.Fatalf("initialized notify failed: %v", err)
	}
}

func testCodeLensCacheActive(t *testing.T, ctx context.Context, clientRPC *jsonrpc2.Conn, diagnostics chan protocol.PublishDiagnosticsParams, uri, agentsPath string) {
	t.Helper()
	// Open document and drain diagnostics
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: "---\ntoolId: claude-3-opus\n---\n# Base",
		},
	}); err != nil {
		t.Fatalf("didOpen notify failed: %v", err)
	}
	drainDiagnostics(diagnostics, 200*time.Millisecond)

	// First and second CodeLens requests should show "Active" (using cache on 2nd)
	assertCodeLensTitle(t, ctx, clientRPC, uri, "Active", "1st")
	assertCodeLensTitle(t, ctx, clientRPC, uri, "Active", "2nd")
}

func testCodeLensCacheShadowed(t *testing.T, ctx context.Context, clientRPC *jsonrpc2.Conn, diagnostics chan protocol.PublishDiagnosticsParams, uri, overridePath string) {
	t.Helper()
	// Create override file to shadow AGENTS.md
	if err := os.WriteFile(overridePath, []byte("---\ntoolId: claude-3-opus\n---\n# Override"), 0o600); err != nil {
		t.Fatalf("write AGENTS.override.md: %v", err)
	}

	overrideURI := pathToURL(overridePath)
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidOpen, protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  overrideURI,
			Text: "---\ntoolId: claude-3-opus\n---\n# Override",
		},
	}); err != nil {
		t.Fatalf("didOpen (override) notify failed: %v", err)
	}
	drainDiagnostics(diagnostics, 200*time.Millisecond)

	// Third CodeLens request should now show "Shadowed"
	assertCodeLensTitle(t, ctx, clientRPC, uri, "Shadowed", "3rd")
}

func testCodeLensCacheActiveAfterRemoval(t *testing.T, ctx context.Context, clientRPC *jsonrpc2.Conn, diagnostics chan protocol.PublishDiagnosticsParams, uri, overridePath string) {
	t.Helper()
	overrideURI := pathToURL(overridePath)
	if err := clientRPC.Notify(ctx, protocol.MethodTextDocumentDidClose, protocol.DidCloseTextDocumentParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: overrideURI},
	}); err != nil {
		t.Fatalf("didClose notify failed: %v", err)
	}
	drainDiagnostics(diagnostics, 100*time.Millisecond)

	if err := os.Remove(overridePath); err != nil {
		t.Fatalf("remove override: %v", err)
	}

	// Fourth CodeLens request should be "Active" again
	assertCodeLensTitle(t, ctx, clientRPC, uri, "Active", "4th")
	drainDiagnostics(diagnostics, 100*time.Millisecond)
}

func assertCodeLensTitle(t *testing.T, ctx context.Context, clientRPC *jsonrpc2.Conn, uri, expectedTitle, callDesc string) {
	t.Helper()
	var lenses []protocol.CodeLens
	if err := clientRPC.Call(ctx, protocol.MethodTextDocumentCodeLens, protocol.CodeLensParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
	}, &lenses); err != nil {
		t.Fatalf("codeLens (%s) failed: %v", callDesc, err)
	}
	if len(lenses) == 0 {
		t.Fatalf("expected code lens (%s call), got none", callDesc)
	}
	if lenses[0].Command == nil || !strings.Contains(lenses[0].Command.Title, expectedTitle) {
		t.Fatalf("expected %s lens (%s), got: %#v", expectedTitle, callDesc, lenses[0])
	}
}

func drainDiagnostics(diagnostics chan protocol.PublishDiagnosticsParams, timeout time.Duration) {
	select {
	case <-diagnostics:
	case <-time.After(timeout):
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
		return nil, nil //nolint:nilnil
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

func requireDiagnostic(t *testing.T, diags []protocol.Diagnostic, ruleID string) protocol.Diagnostic {
	t.Helper()
	for _, diag := range diags {
		if diagnosticRuleID(diag) == ruleID {
			return diag
		}
	}
	t.Fatalf("expected diagnostic %s, got %#v", ruleID, diags)
	return protocol.Diagnostic{}
}

func diagnosticHasTag(diag protocol.Diagnostic, tag protocol.DiagnosticTag) bool {
	for _, candidate := range diag.Tags {
		if candidate == tag {
			return true
		}
	}
	return false
}

func requireDiagnosticSuggestion(t *testing.T, diag protocol.Diagnostic) {
	t.Helper()
	if diag.Message == "" {
		t.Fatalf("expected diagnostic message")
	}
	if len(diag.RelatedInformation) == 0 {
		t.Fatalf("expected related information with suggestion")
	}
	if !strings.Contains(diag.RelatedInformation[0].Message, "Suggestion:") {
		t.Fatalf("expected suggestion related info, got %q", diag.RelatedInformation[0].Message)
	}
	data, ok := diag.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected diagnostic data map, got %#v", diag.Data)
	}
	if value, ok := data["suggestion"].(string); !ok || value == "" {
		t.Fatalf("expected suggestion in diagnostic data, got %#v", data["suggestion"])
	}
	if value, ok := data["ruleId"].(string); !ok || value == "" {
		t.Fatalf("expected ruleId in diagnostic data, got %#v", data["ruleId"])
	}
}

func assertActionContainsText(t *testing.T, actions []protocol.CodeAction, title string, expected string) {
	t.Helper()
	for _, action := range actions {
		if action.Title != title {
			continue
		}
		if actionHasEditText(action, expected) {
			return
		}
		t.Fatalf("expected %q to include %q, got %#v", title, expected, action.Edit)
	}
	t.Fatalf("expected code action %q, got %#v", title, actions)
}

func actionHasEditText(action protocol.CodeAction, expected string) bool {
	if action.Edit == nil {
		return false
	}
	if containsTextEdit(action.Edit.Changes, expected) {
		return true
	}
	if len(action.Edit.DocumentChanges) == 0 {
		return false
	}
	for _, change := range action.Edit.DocumentChanges {
		switch typed := change.(type) {
		case protocol.TextDocumentEdit:
			if containsDocumentEdit(typed, expected) {
				return true
			}
		case map[string]any:
			if containsDocumentEditMap(typed, expected) {
				return true
			}
		}
	}
	return false
}

func containsTextEdit(changes map[protocol.DocumentUri][]protocol.TextEdit, expected string) bool {
	for _, edits := range changes {
		for _, edit := range edits {
			if strings.Contains(edit.NewText, expected) {
				return true
			}
		}
	}
	return false
}

func containsDocumentEdit(edit protocol.TextDocumentEdit, expected string) bool {
	for _, raw := range edit.Edits {
		if te, ok := raw.(protocol.TextEdit); ok {
			if strings.Contains(te.NewText, expected) {
				return true
			}
		}
	}
	return false
}

func containsDocumentEditMap(change map[string]any, expected string) bool {
	edits, ok := change["edits"].([]any)
	if !ok {
		return false
	}
	for _, raw := range edits {
		edit, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		if text, ok := edit["newText"].(string); ok {
			if strings.Contains(text, expected) {
				return true
			}
		}
	}
	return false
}

func findDocumentSymbolByName(symbols []protocol.DocumentSymbol, name string) bool {
	for _, symbol := range symbols {
		if symbol.Name == name {
			return true
		}
	}
	return false
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
			return nil, nil //nolint:nilnil
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

	rpc := jsonrpc2.NewConn(context.Background(), jsonrpc2.NewBufferedStream(conn, jsonrpc2.VSCodeObjectCodec{}), handler)
	t.Cleanup(func() {
		_ = rpc.Close()
	})
	return rpc
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
		return nil, nil //nolint:nilnil
	})

	rpc := jsonrpc2.NewConn(context.Background(), jsonrpc2.NewBufferedStream(conn, jsonrpc2.VSCodeObjectCodec{}), handler)
	t.Cleanup(func() {
		_ = rpc.Close()
	})
	return rpc
}

func buildMarkdowntownBinary(t *testing.T) string {
	t.Helper()
	binName := "markdowntown"
	if runtime.GOOS == "windows" {
		binName += ".exe"
	}
	binPath := filepath.Join(t.TempDir(), binName)
	repoRoot := findRepoRoot(t)
	ctx, cancel := context.WithTimeout(context.Background(), scaledTestTimeout(t, 60*time.Second))
	t.Cleanup(cancel)
	// #nosec G204 -- test harness builds a local binary with fixed args.
	cmd := exec.CommandContext(ctx, "go", "build", "-o", binPath, "./cmd/markdowntown")
	cmd.Env = os.Environ()
	cmd.Dir = repoRoot
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("go build failed: %v\nOutput: %s", err, out)
	}
	return binPath
}

func scaledTestTimeout(t *testing.T, base time.Duration) time.Duration { //nolint:unparam
	t.Helper()
	if raw := os.Getenv("MARKDOWNTOWN_TEST_TIMEOUT_SCALE"); raw != "" {
		if scale, err := strconv.ParseFloat(raw, 64); err == nil && scale > 0 {
			return time.Duration(float64(base) * scale)
		}
	}
	return base
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
