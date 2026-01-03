package lsp

import (
	"math"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"markdowntown-cli/internal/audit"
	"markdowntown-cli/internal/scan"

	"github.com/tliron/glsp"
	protocol "github.com/tliron/glsp/protocol_3_16"
)

func TestServerLifecycleMethods(t *testing.T) {
	s := NewServer("0.1.0")
	if err := s.initialized(nil, &protocol.InitializedParams{}); err != nil {
		t.Fatalf("initialized: %v", err)
	}
	if err := s.shutdown(nil); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
	if err := s.setTrace(nil, &protocol.SetTraceParams{Value: protocol.TraceValueVerbose}); err != nil {
		t.Fatalf("setTrace: %v", err)
	}
}

func TestTriggerDiagnostics(t *testing.T) {
	s := NewServer("0.1.0")
	s.triggerDiagnostics(nil, "file:///tmp/test.md")

	context := &glsp.Context{Notify: func(string, any) {}}
	uri := "file:///tmp/test.md"
	s.triggerDiagnostics(context, uri)

	s.diagnosticsMu.Lock()
	timer := s.diagnosticTimers[uri]
	s.diagnosticsMu.Unlock()
	if timer == nil {
		t.Fatalf("expected timer to be scheduled")
	}
	timer.Stop()
}

func TestIssueToProtocolRange(t *testing.T) {
	empty := issueToProtocolRange(nil)
	if empty.Start.Line != 0 || empty.End.Line != 0 {
		t.Fatalf("expected zero range for nil")
	}

	zero := issueToProtocolRange(&scan.Range{StartLine: 0, StartCol: 0, EndLine: 0, EndCol: 0})
	if zero.Start.Line != 0 || zero.Start.Character != 0 {
		t.Fatalf("expected zero range for StartLine=0, got %+v", zero.Start)
	}

	r := &scan.Range{StartLine: 2, StartCol: 3, EndLine: 4, EndCol: 5}
	got := issueToProtocolRange(r)
	if got.Start.Line != 1 || got.Start.Character != 2 {
		t.Fatalf("unexpected start: %+v", got.Start)
	}
	if got.End.Line != 3 || got.End.Character != 4 {
		t.Fatalf("unexpected end: %+v", got.End)
	}
}

func TestSeverityToProtocolSeverity(t *testing.T) {
	if *severityToProtocolSeverity(audit.SeverityError) != protocol.DiagnosticSeverityError {
		t.Fatalf("expected error severity")
	}
	if *severityToProtocolSeverity(audit.SeverityWarning) != protocol.DiagnosticSeverityWarning {
		t.Fatalf("expected warning severity")
	}
	if *severityToProtocolSeverity(audit.SeverityInfo) != protocol.DiagnosticSeverityInformation {
		t.Fatalf("expected info severity")
	}
	if *severityToProtocolSeverity(audit.Severity("other")) != protocol.DiagnosticSeverityHint {
		t.Fatalf("expected hint severity for unknown")
	}
}

func TestURLToPath(t *testing.T) {
	path, err := urlToPath("file:///tmp/test.md")
	if err != nil {
		t.Fatalf("urlToPath: %v", err)
	}
	if runtime.GOOS != "windows" && path != "/tmp/test.md" {
		t.Fatalf("expected /tmp/test.md, got %s", path)
	}

	if runtime.GOOS == "windows" {
		winPath, err := urlToPath("file:///C:/Temp/space%20here.md")
		if err != nil {
			t.Fatalf("urlToPath windows: %v", err)
		}
		if winPath != `C:\Temp\space here.md` {
			t.Fatalf("expected C:\\Temp\\space here.md, got %s", winPath)
		}

		uncPath, err := urlToPath("file://server/share/space%20here.md")
		if err != nil {
			t.Fatalf("urlToPath UNC: %v", err)
		}
		if uncPath != `\\server\share\space here.md` {
			t.Fatalf("expected \\\\server\\share\\space here.md, got %s", uncPath)
		}

		doubleEscaped, err := urlToPath("file:///C:/Temp/percent%2520space.md")
		if err != nil {
			t.Fatalf("urlToPath double escaped: %v", err)
		}
		if doubleEscaped != `C:\Temp\percent%20space.md` {
			t.Fatalf("expected C:\\Temp\\percent%%20space.md, got %s", doubleEscaped)
		}
	} else {
		escaped, err := urlToPath("file:///tmp/space%20here.md")
		if err != nil {
			t.Fatalf("urlToPath escaped: %v", err)
		}
		if escaped != "/tmp/space here.md" {
			t.Fatalf("expected /tmp/space here.md, got %s", escaped)
		}

		localhost, err := urlToPath("file://localhost/tmp/space%20here.md")
		if err != nil {
			t.Fatalf("urlToPath localhost: %v", err)
		}
		if localhost != "/tmp/space here.md" {
			t.Fatalf("expected /tmp/space here.md from localhost, got %s", localhost)
		}

		doubleEscaped, err := urlToPath("file:///tmp/percent%2520space.md")
		if err != nil {
			t.Fatalf("urlToPath double escaped: %v", err)
		}
		if doubleEscaped != "/tmp/percent%20space.md" {
			t.Fatalf("expected /tmp/percent%%20space.md, got %s", doubleEscaped)
		}
	}

	other, err := urlToPath("not-a-file")
	if err != nil {
		t.Fatalf("urlToPath: %v", err)
	}
	if other != "not-a-file" {
		t.Fatalf("expected passthrough, got %s", other)
	}

	t.Run("Negative", func(t *testing.T) {
		// 1. Malformed percent encoding
		_, err := urlToPath("file:///tmp/%GG")
		if err == nil {
			t.Error("expected error for malformed percent encoding")
		}

		// 2. Query and Fragment should be ignored in path
		path, err := urlToPath("file:///tmp/test.md?query=1#frag")
		if err != nil {
			t.Fatalf("urlToPath with query/frag: %v", err)
		}
		if !strings.HasSuffix(path, "test.md") || strings.Contains(path, "query") {
			t.Errorf("expected path without query/frag, got %s", path)
		}

		// 3. Non-file scheme
		path, err = urlToPath("http://example.com/file.md")
		if err != nil {
			t.Fatalf("urlToPath non-file: %v", err)
		}
		if path != "http://example.com/file.md" {
			t.Errorf("expected passthrough for non-file scheme, got %s", path)
		}

		// 4. Path traversal hardening
		path, err = urlToPath("file:///tmp/../etc/passwd")
		if err != nil {
			t.Fatalf("urlToPath traversal: %v", err)
		}
		expected := filepath.FromSlash("/etc/passwd")
		if runtime.GOOS == "windows" {
			expected = filepath.FromSlash(`\etc\passwd`)
		}
		if path != expected {
			t.Errorf("expected cleaned path %s, got %s", expected, path)
		}
	})
}

func TestClampToUint32(t *testing.T) {
	if got := clampToUint32(-5); got != 0 {
		t.Fatalf("expected 0, got %d", got)
	}
	if got := clampToUint32(42); got != 42 {
		t.Fatalf("expected 42, got %d", got)
	}
	maxUint32 := int(^uint32(0))
	if maxUint32 < math.MaxInt {
		if got := clampToUint32(maxUint32 + 1); got != uint32(maxUint32) {
			t.Fatalf("expected clamp to max uint32, got %d", got)
		}
	} else {
		t.Skip("int size does not allow overflow test")
	}
}

func TestGetValue(t *testing.T) {
	data := map[string]any{
		"a": map[string]any{
			"b": "c",
		},
		"x": "y",
	}
	val, ok := getValue(data, "a.b")
	if !ok || val != "c" {
		t.Fatalf("expected nested value, got %#v (ok=%v)", val, ok)
	}
	if _, ok := getValue(data, "a.missing"); ok {
		t.Fatalf("expected missing path to be false")
	}
	if _, ok := getValue(data, "x.y"); ok {
		t.Fatalf("expected non-map path to be false")
	}
}

func TestBuildRelatedInfoIncludesConfigs(t *testing.T) {
	repoRoot := t.TempDir()
	currentPath := filepath.Join(repoRoot, "AGENTS.md")
	otherPath := filepath.Join(repoRoot, "AGENTS.override.md")
	redactedPath := filepath.Join(repoRoot, "secret.md")

	issue := audit.Issue{
		RuleID:     "MD001",
		Message:    "message",
		Suggestion: "Use the repo config",
		Paths: []audit.Path{
			{Path: "AGENTS.md", Scope: "repo"},
			{Path: "AGENTS.override.md", Scope: "repo"},
			{Path: "secret.md", Scope: "user", Redacted: true},
		},
		Tools: []audit.Tool{{ToolID: "codex", Kind: "agent"}},
		Evidence: map[string]any{
			"field": "value",
		},
	}

	related := buildRelatedInfo(issue, pathToURL(currentPath), currentPath, repoRoot, protocol.Range{
		Start: protocol.Position{Line: 1, Character: 1},
		End:   protocol.Position{Line: 1, Character: 2},
	}, true, audit.RedactNever)

	otherURI := pathToURL(otherPath)
	redactedURI := pathToURL(redactedPath)
	foundOther := false
	for _, info := range related {
		if info.Location.URI == otherURI {
			foundOther = true
			if !strings.Contains(info.Message, "Related config") {
				t.Fatalf("expected related config message, got %q", info.Message)
			}
		}
		if info.Location.URI == redactedURI || strings.Contains(info.Message, "secret.md") {
			t.Fatalf("expected redacted path to be skipped, got %q", info.Message)
		}
	}
	if !foundOther {
		t.Fatalf("expected related info entry for other config")
	}
}

func TestRelatedConfigsLimit(t *testing.T) {
	repoRoot := t.TempDir()
	currentPath := filepath.Join(repoRoot, "one.md")
	paths := []audit.Path{
		{Path: "one.md"},
		{Path: "two.md"},
		{Path: "three.md"},
		{Path: "four.md"},
		{Path: "five.md"},
		{Path: "six.md"},
	}
	related := relatedConfigs(paths, currentPath, repoRoot, relatedConfigLimit)
	if len(related) != relatedConfigLimit {
		t.Fatalf("expected %d related configs, got %d", relatedConfigLimit, len(related))
	}
}

func TestDiagnosticMetadata(t *testing.T) {
	issue := audit.Issue{
		RuleID: "MD002",
		Data: audit.RuleData{
			Tags:   []string{"deprecated", "unnecessary", "other"},
			DocURL: "docs/audit-spec-v1.md",
		},
	}

	tags := diagnosticTags(issue)
	if len(tags) != 2 {
		t.Fatalf("expected two tags, got %v", tags)
	}

	desc := diagnosticCodeDescription("docs/audit-spec-v1.md")
	if desc == nil {
		t.Fatal("expected code description")
	}
	expected := docsBaseURL + "docs/audit-spec-v1.md"
	if desc.HRef != expected {
		t.Fatalf("expected code description %s, got %s", expected, desc.HRef)
	}
}
