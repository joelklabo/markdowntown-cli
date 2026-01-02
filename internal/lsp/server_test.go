package lsp

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

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
	if initResult.Capabilities.TextDocumentSync != protocol.TextDocumentSyncKindFull {
		t.Errorf("expected Full sync, got %v", initResult.Capabilities.TextDocumentSync)
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

func TestRunDiagnosticsWithError(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	s.rootPath = repoRoot

	// Init git repo
	runGit(t, repoRoot, "init")

	setRegistryEnv(t)

	// Create a file with syntax error in YAML
	path := filepath.Join(repoRoot, "GEMINI.md")
	content := []byte("---\nkey: value\ninvalid: [\n---\n# Hello")
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatal(err)
	}

	notifications := make(chan any, 1)
	context := &glsp.Context{
		Notify: func(method string, params any) {
			if method == protocol.ServerTextDocumentPublishDiagnostics {
				notifications <- params
			}
		},
	}

	uri := "file://" + path
	s.runDiagnostics(context, uri)

	select {
	case params := <-notifications:
		diagParams := params.(protocol.PublishDiagnosticsParams)
		foundMD003 := false
		for _, d := range diagParams.Diagnostics {
			if d.Code != nil && d.Code.Value == "MD003" {
				foundMD003 = true
			}
		}
		if !foundMD003 {
			t.Errorf("expected MD003 diagnostic")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for diagnostics")
	}
}

func TestHover(t *testing.T) {
	s := NewServer("0.1.0")
	uri := "file:///repo/GEMINI.md"
	content := "---\ntoolId: gemini-cli\n---\n# Hello"
	setRegistryEnv(t)

	if err := s.didOpen(nil, &protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen failed: %v", err)
	}

	// Hover over toolId value (line 2)
	params := &protocol.HoverParams{
		TextDocumentPositionParams: protocol.TextDocumentPositionParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: uri},
			Position:     protocol.Position{Line: 1, Character: 8},
		},
	}

	hover, err := s.hover(nil, params)
	if err != nil {
		t.Fatalf("hover failed: %v", err)
	}

	if hover == nil {
		t.Fatal("expected hover result")
	}

	markup := hover.Contents.(protocol.MarkupContent)
	if !strings.Contains(markup.Value, "Gemini CLI") {
		t.Errorf("expected hover content to contain Gemini CLI, got %s", markup.Value)
	}
}

func TestDefinition(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	s.rootPath = repoRoot
	s.fs = afero.NewCopyOnWriteFs(afero.NewOsFs(), s.overlay)

	uri := "file://" + filepath.Join(repoRoot, "GEMINI.md")
	content := "---\ntoolId: gemini-cli\n---\n# Hello"

	// Create AGENTS.md
	agentsPath := filepath.Join(repoRoot, "AGENTS.md")
	if err := os.WriteFile(agentsPath, []byte("# Agents"), 0600); err != nil {
		t.Fatal(err)
	}

	if err := s.didOpen(nil, &protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen failed: %v", err)
	}

	params := &protocol.DefinitionParams{
		TextDocumentPositionParams: protocol.TextDocumentPositionParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: uri},
			Position:     protocol.Position{Line: 1, Character: 8},
		},
	}

	result, err := s.definition(nil, params)
	if err != nil {
		t.Fatalf("definition failed: %v", err)
	}

	if result == nil {
		t.Fatal("expected definition result")
	}

	loc := result.(protocol.Location)
	if !strings.Contains(loc.URI, "AGENTS.md") {
		t.Errorf("expected link to AGENTS.md, got %s", loc.URI)
	}
}

func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\nOutput: %s", args, err, out)
	}
}

func setRegistryEnv(t *testing.T) {
	t.Helper()
	wd, _ := os.Getwd()
	for {
		candidate := filepath.Join(wd, "data", "ai-config-patterns.json")
		if _, err := os.Stat(candidate); err == nil {
			t.Setenv("MARKDOWNTOWN_REGISTRY", candidate)
			return
		}
		parent := filepath.Dir(wd)
		if parent == wd {
			t.Fatal("could not find registry")
		}
		wd = parent
	}
}
