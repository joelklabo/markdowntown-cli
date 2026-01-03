package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"testing"

	"markdowntown-cli/internal/instructions"
	"markdowntown-cli/internal/suggest"
)

func TestSuggestCLI(t *testing.T) {
	tmp := t.TempDir()
	sourcesPath := filepath.Join(tmp, "doc-sources.json")
	if err := os.WriteFile(sourcesPath, []byte(testSourcesJSON("https://example.com/docs")), 0o600); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv("MARKDOWNTOWN_SOURCES", sourcesPath)
	t.Setenv("XDG_DATA_HOME", filepath.Join(tmp, "data"))

	var out bytes.Buffer
	err := runSuggestWithIO(&out, io.Discard, []string{"--offline", "--format", "json"})
	if err != nil {
		t.Fatalf("runSuggest failed: %v", err)
	}

	var report suggest.Report
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

func TestSuggestOfflineUsesCache(t *testing.T) {
	tmp := t.TempDir()
	sourcesPath := filepath.Join(tmp, "doc-sources.json")
	sourceURL := "https://example.com/docs"
	if err := os.WriteFile(sourcesPath, []byte(testSourcesJSON(sourceURL)), 0o600); err != nil {
		t.Fatalf("write sources: %v", err)
	}
	t.Setenv("MARKDOWNTOWN_SOURCES", sourcesPath)
	t.Setenv("XDG_DATA_HOME", filepath.Join(tmp, "data"))

	cache, err := suggest.NewFileCache()
	if err != nil {
		t.Fatalf("init cache: %v", err)
	}
	body := []byte("You MUST keep instructions short.")
	if err := cache.Put(sourceURL, body); err != nil {
		t.Fatalf("cache put: %v", err)
	}

	var out bytes.Buffer
	err = runSuggestWithIO(&out, io.Discard, []string{"--offline", "--format", "json"})
	if err != nil {
		t.Fatalf("runSuggest failed: %v", err)
	}

	var report suggest.Report
	if err := json.Unmarshal(out.Bytes(), &report); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}
	if len(report.Suggestions) == 0 {
		t.Fatalf("expected cached suggestions")
	}
	if report.Suggestions[0].Sources[0] != sourceURL {
		t.Fatalf("expected source %s, got %v", sourceURL, report.Suggestions[0].Sources)
	}
}

func testSourcesJSON(url string) string {
	return `{
  "version": "1.0",
  "allowlistHosts": ["example.com"],
  "sources": [
    {"id": "codex-doc", "tier": "tier-0", "client": "codex", "url": "` + url + `", "refreshHours": 24}
  ]
}`
}
