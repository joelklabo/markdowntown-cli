package lsp

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/spf13/afero"
	"github.com/tliron/commonlog"
	_ "github.com/tliron/commonlog/simple"
	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

func TestMain(m *testing.M) {
	commonlog.Configure(2, nil)
	os.Exit(m.Run())
}

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

	context := &glsp.Context{
		Notify: func(method string, params any) {},
	}

	// 1. didOpen
	err := s.didOpen(context, &protocol.DidOpenTextDocumentParams{
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
	err = s.didChange(context, &protocol.DidChangeTextDocumentParams{
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
	err = s.didClose(context, &protocol.DidCloseTextDocumentParams{
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



	// Init git repo to make it a valid repo root for scan
	runGit(t, repoRoot, "init")



	// Set registry
	wd, _ := os.Getwd()
	for {

		candidate := filepath.Join(wd, "data", "ai-config-patterns.json")

		if _, err := os.Stat(candidate); err == nil {

			t.Setenv("MARKDOWNTOWN_REGISTRY", candidate)

			break

		}

		parent := filepath.Dir(wd)

		if parent == wd {

			t.Fatal("could not find registry")

		}

		wd = parent

	}



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



func runGit(t *testing.T, dir string, args ...string) {



	t.Helper()



	cmd := exec.Command("git", args...)



	cmd.Dir = dir



	if out, err := cmd.CombinedOutput(); err != nil {



		t.Fatalf("git %v failed: %v\nOutput: %s", args, err, out)



	}



}