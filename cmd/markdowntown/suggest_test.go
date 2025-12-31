package main

import (
	"bytes"
	"encoding/json"
	"io"
	"testing"

	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/suggest"
)

func TestSuggestCLI(t *testing.T) {
	var out bytes.Buffer
	err := runSuggestWithIO(&out, io.Discard, []string{"--offline", "--format", "json"})
	if err != nil {
		t.Fatalf("runSuggest failed: %v", err)
	}

	var report suggest.SuggestReport
	if err := json.Unmarshal(out.Bytes(), &report); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}

	if report.Client != instructions.ClientCodex {
		t.Fatalf("expected client codex, got %s", report.Client)
	}
	if len(report.Warnings) == 0 {
		t.Fatalf("expected warnings for offline mode")
	}
}
