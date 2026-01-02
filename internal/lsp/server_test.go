package lsp

import (
	"testing"

	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

func TestInitialize(t *testing.T) {
	version = "0.1.0"
	context := &glsp.Context{}
	params := &protocol.InitializeParams{}

	result, err := initialize(context, params)
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
