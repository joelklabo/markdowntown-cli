package suggest

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"markdowntown-cli/internal/instructions"
)

func TestWriteSuggestReportJSON(t *testing.T) {
	report := Report{
		Client: "codex",
		Suggestions: []Suggestion{
			{ID: "S1", Text: "Do thing", Sources: []string{"https://example.com"}},
		},
	}

	var buf bytes.Buffer
	if err := WriteSuggestReport(&buf, "json", report); err != nil {
		t.Fatalf("WriteSuggestReport: %v", err)
	}

	var decoded Report
	if err := json.Unmarshal(buf.Bytes(), &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(decoded.Suggestions) != 1 {
		t.Fatalf("expected 1 suggestion, got %d", len(decoded.Suggestions))
	}
}

func TestWriteSuggestReportMarkdown(t *testing.T) {
	report := Report{
		Client: "copilot",
		Suggestions: []Suggestion{
			{ID: "S1", Text: "Use pnpm", Sources: []string{"https://example.com"}},
		},
		Conflicts: []Conflict{{Reason: "conflict", ClaimIDs: []string{"C1"}}},
		Omissions: []Omission{{ClaimID: "C2", Reason: "missing"}},
		Warnings:  []string{"warn"},
	}

	var buf bytes.Buffer
	if err := WriteSuggestReport(&buf, "md", report); err != nil {
		t.Fatalf("WriteSuggestReport markdown: %v", err)
	}
	output := buf.String()
	if !strings.Contains(output, "# Suggestions") {
		t.Fatalf("expected markdown heading")
	}
	if !strings.Contains(output, "## Conflicts") || !strings.Contains(output, "## Omissions") || !strings.Contains(output, "## Warnings") {
		t.Fatalf("expected audit sections")
	}
}

func TestWriteResolveReportMarkdown(t *testing.T) {
	report := ResolveReport{
		Client: "codex",
		Resolution: instructions.Resolution{
			Applied: []instructions.InstructionFile{
				{Path: "./AGENTS.md", Scope: "repo", Reason: "primary"},
			},
			Conflicts: []instructions.Conflict{{Reason: "order", Paths: []string{"a", "b"}}},
			SettingsRequired: []string{
				"setting-a",
			},
		},
	}

	var buf bytes.Buffer
	if err := WriteResolveReport(&buf, "md", report); err != nil {
		t.Fatalf("WriteResolveReport: %v", err)
	}
	output := buf.String()
	if !strings.Contains(output, "## Applied Files") {
		t.Fatalf("expected applied files section")
	}
	if !strings.Contains(output, "## Conflicts") || !strings.Contains(output, "## Settings Required") {
		t.Fatalf("expected conflicts/settings sections")
	}
}

func TestWriteResolveReportJSON(t *testing.T) {
	report := ResolveReport{
		Client: "codex",
		Resolution: instructions.Resolution{
			Applied: []instructions.InstructionFile{
				{Path: "./AGENTS.md", Scope: "repo", Reason: "primary"},
			},
		},
	}

	var buf bytes.Buffer
	if err := WriteResolveReport(&buf, "json", report); err != nil {
		t.Fatalf("WriteResolveReport json: %v", err)
	}

	var decoded ResolveReport
	if err := json.Unmarshal(buf.Bytes(), &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(decoded.Resolution.Applied) != 1 {
		t.Fatalf("expected applied files")
	}
}

func TestNormalizeFormat(t *testing.T) {
	if normalizeFormat("markdown") != "md" {
		t.Fatalf("expected markdown to normalize to md")
	}
	if normalizeFormat("") != "json" {
		t.Fatalf("expected empty format to normalize to json")
	}
	if normalizeFormat("xml") != "xml" {
		t.Fatalf("expected unknown format passthrough")
	}
}

func TestWriteSuggestReportUnsupportedFormat(t *testing.T) {
	var buf bytes.Buffer
	if err := WriteSuggestReport(&buf, "xml", Report{}); err == nil {
		t.Fatalf("expected error for unsupported format")
	}
}

func TestWriteResolveReportUnsupportedFormat(t *testing.T) {
	var buf bytes.Buffer
	if err := WriteResolveReport(&buf, "xml", ResolveReport{}); err == nil {
		t.Fatalf("expected error for unsupported format")
	}
}
