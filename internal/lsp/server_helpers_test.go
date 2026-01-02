package lsp

import (
	"math"
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
	if path != "/tmp/test.md" {
		t.Fatalf("expected /tmp/test.md, got %s", path)
	}

	other, err := urlToPath("not-a-file")
	if err != nil {
		t.Fatalf("urlToPath: %v", err)
	}
	if other != "not-a-file" {
		t.Fatalf("expected passthrough, got %s", other)
	}
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
