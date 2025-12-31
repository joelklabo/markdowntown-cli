package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"markdowntown-cli/internal/scan"
)

func TestPrintUsage(t *testing.T) {
	var buf bytes.Buffer
	printUsage(&buf)
	if !strings.Contains(buf.String(), "markdowntown scan") {
		t.Fatalf("expected scan usage in output")
	}
}

func TestPrintScanUsage(t *testing.T) {
	var buf bytes.Buffer
	printScanUsage(&buf)
	if !strings.Contains(buf.String(), "markdowntown scan") {
		t.Fatalf("expected scan usage in output")
	}
}

func TestRunToolsListOutputsJSON(t *testing.T) {
	registry := `{
  "version": "1",
  "patterns": [
    {
      "id": "p1",
      "toolId": "tool-a",
      "toolName": "Tool A",
      "kind": "instructions",
      "scope": "repo",
      "paths": ["AGENTS.md"],
      "type": "glob",
      "loadBehavior": "single",
      "application": "auto",
      "docs": ["https://example.com"]
    }
  ]
}`
	path := filepath.Join(t.TempDir(), "registry.json")
	if err := os.WriteFile(path, []byte(registry), 0o600); err != nil {
		t.Fatalf("write registry: %v", err)
	}
	t.Setenv(scan.RegistryEnvVar, path)

	output := captureStdout(t, func() {
		if err := runToolsList(); err != nil {
			t.Fatalf("runToolsList: %v", err)
		}
	})

	var summaries []scan.ToolSummary
	if err := json.Unmarshal([]byte(output), &summaries); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(summaries))
	}
}

func TestRunRegistryRequiresSubcommand(t *testing.T) {
	if err := runRegistry([]string{}); err == nil {
		t.Fatalf("expected error for missing registry subcommand")
	}
}

func TestRunToolsRequiresSubcommand(t *testing.T) {
	if err := runTools([]string{}); err == nil {
		t.Fatalf("expected error for missing tools subcommand")
	}
}

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	os.Stdout = w

	fn()
	_ = w.Close()
	os.Stdout = old

	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("read output: %v", err)
	}
	return string(data)
}
