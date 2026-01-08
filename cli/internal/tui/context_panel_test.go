package tui

import (
	"strings"
	"testing"

	"markdowntown-cli/internal/instructions"
)

func TestRenderContextDetails(t *testing.T) {
	res := &instructions.Resolution{
		RepoRoot: "/repo",
		Applied: []instructions.InstructionFile{
			{Path: "/repo/GEMINI.md", Scope: instructions.ScopeRepo, Reason: instructions.ReasonPrimary},
			{Path: "/repo/CLAUDE.md", Scope: instructions.ScopeRepo, Reason: instructions.ReasonOverride, Truncated: true, IncludedBytes: 100},
		},
		Warnings: []string{"warning 1"},
	}

	view := renderContextDetails(res)

	if !strings.Contains(view, "Applied Files") {
		t.Errorf("view missing Applied Files header")
	}
	if !strings.Contains(view, "GEMINI.md") {
		t.Errorf("view missing GEMINI.md")
	}
	if !strings.Contains(view, "CLAUDE.md") {
		t.Errorf("view missing CLAUDE.md")
	}
	if !strings.Contains(view, "Truncated") {
		t.Errorf("view missing Truncated warning")
	}
	if !strings.Contains(view, "warning 1") {
		t.Errorf("view missing warning")
	}
	if !strings.Contains(view, "/repo") {
		t.Errorf("view missing repo root")
	}
}

func TestFormatBytes(t *testing.T) {
	tests := []struct {
		bytes int64
		want  string
	}{
		{500, "500 B"},
		{1024, "1.0 KB"},
		{1024 * 1024, "1.0 MB"},
	}

	for _, tt := range tests {
		if got := formatBytes(tt.bytes); got != tt.want {
			t.Errorf("formatBytes(%d) = %s, want %s", tt.bytes, got, tt.want)
		}
	}
}
