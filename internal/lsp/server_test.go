package lsp

import (
	"testing"

	"github.com/spf13/afero"
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

func TestInitialize(t *testing.T) {
	s := NewServer("0.1.0")
	context := &glsp.Context{}
	params := &protocol.InitializeParams{}

	result, err := s.initialize(context, params)
	if err != nil {
		t.Fatalf("initialize failed: %v", err)
	}

	initResult := result.(protocol.InitializeResult)
	if initResult.Capabilities.TextDocumentSync != protocol.TextDocumentSyncKindIncremental {
		t.Errorf("expected Incremental sync, got %v", initResult.Capabilities.TextDocumentSync)
	}

	if initResult.ServerInfo.Name != serverName {
		t.Errorf("expected server name %s, got %s", serverName, initResult.ServerInfo.Name)
	}
}

func TestDocumentSync(t *testing.T) {
	s := NewServer("0.1.0")
	uri := "file:///repo/test.md"
	path := "/repo/test.md"
	content := "# Hello"

	// 1. didOpen
	err := s.didOpen(nil, &protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	})
	if err != nil {
		t.Fatalf("didOpen failed: %v", err)
	}

	// Verify in overlay
	data, err := afero.ReadFile(s.overlay, path)
	if err != nil {
		t.Fatalf("read overlay failed: %v", err)
	}
	if string(data) != content {
		t.Errorf("expected %s, got %s", content, string(data))
	}

	// 2. didChange (full content sync)
	newContent := "# Updated"
	err = s.didChange(nil, &protocol.DidChangeTextDocumentParams{
		TextDocument: protocol.VersionedTextDocumentIdentifier{
			TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
		},
		ContentChanges: []any{
			protocol.TextDocumentContentChangeEvent{Text: newContent},
		},
	})
	if err != nil {
		t.Fatalf("didChange failed: %v", err)
	}

	data, err = afero.ReadFile(s.overlay, path)
	if err != nil {
		t.Fatalf("read overlay after change failed: %v", err)
	}
	if string(data) != newContent {
		t.Errorf("expected %s, got %s", newContent, string(data))
	}

	// 3. didClose
	err = s.didClose(nil, &protocol.DidCloseTextDocumentParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
	})
	if err != nil {
		t.Fatalf("didClose failed: %v", err)
	}

	exists, err := afero.Exists(s.overlay, path)
	if err != nil {
		t.Fatalf("exists overlay failed: %v", err)
	}
	if exists {
		t.Errorf("expected file to be removed from overlay")
	}
}
