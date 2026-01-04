package lsp

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"

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
	path := filepath.Join(t.TempDir(), "test.md")
	uri := pathToURL(path)
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
		t.Fatalf("read overlay failed: %v (path: %s)", err, path)
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

func TestDidChangeIgnoresStaleVersion(t *testing.T) {
	s := NewServer("0.1.0")
	path := filepath.Join(t.TempDir(), "test.md")
	uri := pathToURL(path)
	content := "# Hello"

	if err := s.didOpen(nil, &protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:     uri,
			Text:    content,
			Version: 2,
		},
	}); err != nil {
		t.Fatalf("didOpen failed: %v", err)
	}

	updated := "# Updated"
	if err := s.didChange(nil, &protocol.DidChangeTextDocumentParams{
		TextDocument: protocol.VersionedTextDocumentIdentifier{
			TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
			Version:                3,
		},
		ContentChanges: []any{
			protocol.TextDocumentContentChangeEvent{Text: updated},
		},
	}); err != nil {
		t.Fatalf("didChange failed: %v", err)
	}

	stale := "# Stale"
	if err := s.didChange(nil, &protocol.DidChangeTextDocumentParams{
		TextDocument: protocol.VersionedTextDocumentIdentifier{
			TextDocumentIdentifier: protocol.TextDocumentIdentifier{URI: uri},
			Version:                2,
		},
		ContentChanges: []any{
			protocol.TextDocumentContentChangeEvent{Text: stale},
		},
	}); err != nil {
		t.Fatalf("didChange failed: %v", err)
	}

	data, err := afero.ReadFile(s.overlay, path)
	if err != nil {
		t.Fatalf("read overlay failed: %v", err)
	}
	if string(data) != updated {
		t.Fatalf("expected stale update to be ignored, got %s", string(data))
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

	uri := pathToURL(path)
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
	path := filepath.Join(t.TempDir(), "GEMINI.md")
	uri := pathToURL(path)
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

func TestDefinitionRegistry(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	s.rootPath = repoRoot
	s.fs = afero.NewCopyOnWriteFs(afero.NewOsFs(), s.overlay)
	setRegistryEnv(t)

	uri := pathToURL(filepath.Join(repoRoot, "GEMINI.md"))
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
	if !strings.Contains(loc.URI, "ai-config-patterns.json") {
		t.Errorf("expected link to registry, got %s", loc.URI)
	}
	if loc.Range.Start.Line == 0 && loc.Range.End.Line == 0 {
		t.Fatalf("expected registry range, got %+v", loc.Range)
	}
}

func TestDefinitionFallbackToAgents(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	s.rootPath = repoRoot
	s.fs = afero.NewCopyOnWriteFs(afero.NewOsFs(), s.overlay)
	t.Setenv(scan.RegistryEnvVar, filepath.Join(repoRoot, "missing-registry.json"))

	uri := pathToURL(filepath.Join(repoRoot, "GEMINI.md"))
	content := "---\ntoolId: gemini-cli\n---\n# Hello"

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

func TestDefinitionNonToolIDReturnsNil(t *testing.T) {
	s := NewServer("0.1.0")
	repoRoot := t.TempDir()
	s.rootPath = repoRoot
	s.fs = afero.NewCopyOnWriteFs(afero.NewOsFs(), s.overlay)
	setRegistryEnv(t)

	uri := pathToURL(filepath.Join(repoRoot, "AGENTS.md"))
	content := "---\nscope: repo\n---\n# Hello"

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
			Position:     protocol.Position{Line: 1, Character: 2},
		},
	}

	result, err := s.definition(nil, params)
	if err != nil {
		t.Fatalf("definition failed: %v", err)
	}
	if result != nil {
		t.Fatalf("expected nil definition, got %#v", result)
	}
}

func TestDocumentSymbolFrontmatter(t *testing.T) {
	s := NewServer("0.1.0")
	path := filepath.Join(t.TempDir(), "AGENTS.md")
	uri := pathToURL(path)
	content := strings.Join([]string{
		"---",
		"toolId: gemini-cli",
		"metadata:",
		"  owner: alice",
		"excludeAgents:",
		"  - codex",
		"  - claude",
		"---",
		"# Hello",
	}, "\n")

	if err := s.didOpen(nil, &protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen failed: %v", err)
	}

	result, err := s.documentSymbol(nil, &protocol.DocumentSymbolParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
	})
	if err != nil {
		t.Fatalf("documentSymbol failed: %v", err)
	}
	if result == nil {
		t.Fatal("expected document symbols, got nil")
	}

	symbols, ok := result.([]protocol.DocumentSymbol)
	if !ok {
		t.Fatalf("expected []DocumentSymbol, got %#v", result)
	}
	if len(symbols) != 1 {
		t.Fatalf("expected root symbol, got %#v", symbols)
	}
	root := symbols[0]
	if root.Name != "Frontmatter" {
		t.Fatalf("expected Frontmatter root, got %q", root.Name)
	}
	if len(root.Children) == 0 {
		t.Fatalf("expected frontmatter children, got none")
	}

	expected := []string{
		"toolId",
		"metadata",
		"metadata.owner",
		"excludeAgents",
		"excludeAgents[0]",
		"excludeAgents[1]",
	}
	for _, name := range expected {
		if _, ok := findDocumentSymbol(root.Children, name); !ok {
			t.Fatalf("expected symbol %q, got %#v", name, root.Children)
		}
	}

	toolSymbol, ok := findDocumentSymbol(root.Children, "toolId")
	if !ok {
		t.Fatalf("expected toolId symbol")
	}
	line := "toolId: gemini-cli"
	keyStart := strings.Index(line, "toolId")
	valueStart := strings.Index(line, "gemini-cli")
	valueEnd := valueStart + len("gemini-cli")
	if toolSymbol.Range.Start.Line != 1 || toolSymbol.Range.Start.Character != clampToUint32(keyStart) {
		t.Fatalf("unexpected toolId range start: %+v", toolSymbol.Range.Start)
	}
	if toolSymbol.Range.End.Line != 1 || toolSymbol.Range.End.Character != clampToUint32(valueEnd) {
		t.Fatalf("unexpected toolId range end: %+v", toolSymbol.Range.End)
	}
	if toolSymbol.SelectionRange.Start.Line != 1 || toolSymbol.SelectionRange.Start.Character != clampToUint32(valueStart) {
		t.Fatalf("unexpected toolId selection start: %+v", toolSymbol.SelectionRange.Start)
	}
	if toolSymbol.SelectionRange.End.Line != 1 || toolSymbol.SelectionRange.End.Character != clampToUint32(valueEnd) {
		t.Fatalf("unexpected toolId selection end: %+v", toolSymbol.SelectionRange.End)
	}
}

func TestDocumentSymbolNoFrontmatter(t *testing.T) {
	s := NewServer("0.1.0")
	path := filepath.Join(t.TempDir(), "README.md")
	uri := pathToURL(path)
	content := "# Hello"

	if err := s.didOpen(nil, &protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:  uri,
			Text: content,
		},
	}); err != nil {
		t.Fatalf("didOpen failed: %v", err)
	}

	result, err := s.documentSymbol(nil, &protocol.DocumentSymbolParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: uri},
	})
	if err != nil {
		t.Fatalf("documentSymbol failed: %v", err)
	}
	if result != nil {
		t.Fatalf("expected no symbols, got %#v", result)
	}
}

func TestDiagnosticCodeDescriptionSanitize(t *testing.T) {
	desc := diagnosticCodeDescription("https://example.com/docs")
	if desc == nil || desc.HRef != "https://example.com/docs" {
		t.Fatalf("expected https doc URL, got %#v", desc)
	}

	if desc := diagnosticCodeDescription("http://example.com/docs"); desc != nil {
		t.Fatalf("expected http URL to be rejected")
	}

	if desc := diagnosticCodeDescription("file:///tmp/docs"); desc != nil {
		t.Fatalf("expected file URL to be rejected")
	}

	if desc := diagnosticCodeDescription("command:open"); desc != nil {
		t.Fatalf("expected command URL to be rejected")
	}

	if desc := diagnosticCodeDescription("javascript:alert(1)"); desc != nil {
		t.Fatalf("expected javascript URL to be rejected")
	}

	if desc := diagnosticCodeDescription("data:text/plain,hello"); desc != nil {
		t.Fatalf("expected data URL to be rejected")
	}

	desc = diagnosticCodeDescription("docs/audit-spec-v1.md")
	if desc == nil || desc.HRef != docsBaseURL+"docs/audit-spec-v1.md" {
		t.Fatalf("expected relative doc URL to map to base URL, got %#v", desc)
	}
}

func TestDiagnosticForIssueMetadata(t *testing.T) {
	issue := audit.Issue{
		RuleID:     "MD002",
		Severity:   audit.SeverityWarning,
		Title:      "Gitignored config",
		Message:    "Repo config is ignored by git; teammates and CI will not see it.",
		Suggestion: "Remove this path from .gitignore or move the file to a tracked location.",
		Paths:      []audit.Path{{Path: "/repo/AGENTS.md", Scope: "repo"}},
		Data: audit.RuleData{
			Category: "scope",
			DocURL:   "docs/audit-spec-v1.md",
			Tags:     []string{"unnecessary"},
		},
	}

	diag := diagnosticForIssue(issue, "file:///repo/AGENTS.md", "/repo/AGENTS.md", "/repo", false, false, true, true, audit.RedactNever)
	if diag.CodeDescription == nil || !strings.Contains(diag.CodeDescription.HRef, "docs/audit-spec-v1.md") {
		t.Fatalf("expected code description, got %#v", diag.CodeDescription)
	}
	found := false
	for _, tag := range diag.Tags {
		if tag == protocol.DiagnosticTagUnnecessary {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected unnecessary tag, got %#v", diag.Tags)
	}
}

func TestDiagnosticRedactionFiltersPaths(t *testing.T) {
	issue := audit.Issue{
		RuleID:  "MD001",
		Message: "message",
		Paths: []audit.Path{
			{Path: "/tmp/secret.md", Scope: "user"},
		},
		Evidence: map[string]any{
			"path":         "/tmp/secret.md",
			"requiredKeys": []string{"toolId"},
		},
	}

	diag := diagnosticForIssue(issue, "file:///tmp/secret.md", "/tmp/secret.md", "/repo", true, true, false, false, audit.RedactAlways)
	data, ok := diag.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected diagnostic data map, got %#v", diag.Data)
	}
	paths, ok := data["paths"].([]audit.Path)
	if !ok {
		t.Fatalf("expected diagnostic paths, got %#v", data["paths"])
	}
	if len(paths) != 0 {
		t.Fatalf("expected redacted paths to be filtered, got %#v", paths)
	}
	evidence, ok := data["evidence"].(map[string]any)
	if !ok {
		t.Fatalf("expected evidence map, got %#v", data["evidence"])
	}
	if _, ok := evidence["path"]; ok {
		t.Fatalf("expected absolute path evidence to be removed")
	}
	if _, ok := evidence["requiredKeys"]; !ok {
		t.Fatalf("expected non-path evidence to remain")
	}
	if diag.RelatedInformation != nil {
		t.Fatalf("expected related info to be omitted when redaction is enabled")
	}

	diag = diagnosticForIssue(issue, "file:///tmp/secret.md", "/tmp/secret.md", "/repo", true, true, false, false, audit.RedactNever)
	data = diag.Data.(map[string]any)
	paths = data["paths"].([]audit.Path)
	if len(paths) != 1 {
		t.Fatalf("expected paths to remain when redaction disabled, got %#v", paths)
	}
}

func TestSortCodeActionEntries(t *testing.T) {
	entries := []codeActionEntry{
		{
			action: protocol.CodeAction{Title: "B"},
			ruleID: "MD004",
			fixID:  "b",
			title:  "B",
		},
		{
			action:    protocol.CodeAction{Title: "A"},
			ruleID:    "MD003",
			fixID:     "a",
			preferred: true,
			title:     "A",
		},
		{
			action: protocol.CodeAction{Title: "A"},
			ruleID: "MD002",
			fixID:  "c",
			title:  "A",
		},
	}

	sortCodeActionEntries(entries)
	if entries[0].title != "A" || !entries[0].preferred {
		t.Fatalf("expected preferred action first, got %#v", entries[0])
	}
	if entries[1].title != "A" || entries[1].preferred {
		t.Fatalf("expected non-preferred action second, got %#v", entries[1])
	}
	if entries[2].title != "B" {
		t.Fatalf("expected remaining action last, got %#v", entries[2])
	}
}

func TestCodeActionReplaceToolIDIdempotent(t *testing.T) {
	content := "---\ntoolId: foo\n---\n"
	diag := protocol.Diagnostic{
		Range: protocol.Range{
			Start: protocol.Position{Line: 1, Character: 8},
			End:   protocol.Position{Line: 1, Character: 11},
		},
		Data: map[string]any{
			"toolId":      "foo",
			"replacement": "bar",
		},
	}

	if action := codeActionReplaceToolID(diag, "file:///tmp/test.md", content); action == nil {
		t.Fatalf("expected toolId replacement action")
	}
	updated := strings.Replace(content, "foo", "bar", 1)
	if action := codeActionReplaceToolID(diag, "file:///tmp/test.md", updated); action != nil {
		t.Fatalf("expected replacement to be skipped when already applied")
	}
}

func findDocumentSymbol(symbols []protocol.DocumentSymbol, name string) (protocol.DocumentSymbol, bool) {
	for _, symbol := range symbols {
		if symbol.Name == name {
			return symbol, true
		}
	}
	return protocol.DocumentSymbol{}, false
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
